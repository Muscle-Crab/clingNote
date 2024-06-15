<template>
  <!-- Main wrapper for the entire app -->
  <div class="min-h-screen bg-gray-900 dark:bg-[#1c1c1e]" >
    <!-- Container for the entire room -->
    <div class="container mx-auto px-4 py-1 pt-10">

      <!-- Grid layout for different sections -->
      <Skeleton :loading="loading" v-if="loading"/>

      <div v-else class="md:grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <!-- Actual Content -->
        <!-- Left Sidebar: Participants -->
        <div class="col-span-1 mb-5 bg-gray-900 rounded-lg   dark:bg-gray-800">
          <h2 class="text-xl font-semibold text-gray-200 mb-4">Participants</h2>
          <ul class="space-y-4">
            <li v-for="(participant, index) in visibleParticipants" :key="participant.id" class="flex items-center">
              <div class="w-12 h-12 rounded-full mr-4 flex items-center justify-center bg-gray-700 text-white text-xl">
                <img v-if="participant.avatar" :src="participant.avatar" alt="Participant" class="rounded-full w-full h-full">
                <span v-else>{{ participant.name.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="text-gray-200">{{ participant.name }}</span>
            </li>
          </ul>
          <!-- Use Font Awesome icons instead of a button -->
          <div>
            <!-- Your content here -->
            <div
                @click="toggleShowMore"
                class="mt-4 p-3 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 flex items-center justify-center"
                style="width: 40px; height: 40px;"
            >
              <i :class="showMore ? 'fas fa-chevron-up' : 'fas fa-chevron-down'" class="text-xl"></i>
            </div>
          </div>

        </div>

        <!-- Main Content: Posts -->
        <div class="col-span-2 grid grid-cols-1 gap-8 mb-10">
          <div v-for="post in filteredPosts" :key="post.id" :id="'post-' + post.id" class="md:min-w-[320px]">
            <div class="min-w-sm  bg-gray-900 b rounded-lg  dark:bg-gray-800 dark:border-gray-700">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                  <div class="w-12 h-12 rounded-full mr-2 flex items-center justify-center bg-gray-700 text-white text-xl">
                    <img v-if="getParticipantAvatar(post.userId)" :src="getParticipantAvatar(post.userId)" alt="User" class="rounded-full w-full h-full">
                    <span v-else>{{ getParticipantName(post.userId).charAt(0).toUpperCase() }}</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-semibold text-gray-200">{{ getParticipantName(post.userId) }}</span>
                    <span class="text-sm text-gray-400">{{ formatTimestamp(post.timestamp) }}</span>
                  </div>
                </div>
                <button @click="speakText(getParticipantName(post.userId), post.topic)" class="text-gray-400 hover:text-indigo-400 focus:outline-none">
                  <i class="fa fa-volume-up"></i>
                </button>
              </div>
              <a href="#">
                <h5 class="mb-2 font-bold tracking-tight text-gray-200 dark:text-white">{{ post.topic }}</h5>
              </a>
              <div v-if="post.mediaUrl" class="flex justify-center">
                <template v-if="isVideoUrl(post.mediaUrl)">
                  <video class="w-96 h-auto rounded-lg" autoplay muted playsinline>
                    <source :src="post.mediaUrl" type="video/mp4">
                    Your browser does not support the video tag.
                  </video>
                </template>
                <template v-else>
                  <img :src="post.mediaUrl" alt="Uploaded Image" class="w-96 h-auto rounded-lg"/>
                </template>
              </div>


              <a v-if="post.url?.includes('youtube.com')" :href="post.url" target="_blank">
                <iframe width="100%" height="200" :src="'https://www.youtube.com/embed/' + extractYouTubeId(post.url)" frameborder="0" allowfullscreen></iframe>
              </a>
              <a v-else-if="post.url?.includes('tiktok.com')" :href="post.url" target="_blank">
                <iframe width="100%" height="200" :src="'https://www.tiktok.com/embed/v2/' + extractTikTokId(post.url)" frameborder="0" allowfullscreen></iframe>
              </a>

              <p class="text-gray-400 mb-4">{{ post.message }}</p>
              <div class="flex justify-between items-center">
                <div>
                  <button @click="toggleLike(post)" class="flex items-center text-blue-400 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                    </svg>
                    <span>{{ post.likes }}</span>
                  </button>
                </div>
                <div class="relative">
                  <button @click="toggleCommentSection(post)" class="flex items-center text-blue-400 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l3 3m-3-3l-3 3m3-3H3a2 2 0 01-2-2V5a2 2 0 012-2h18a2 2 0 012 2v10a2 2 0 01-2 2h-8l-3 3z"></path>
                    </svg>
                    <span>{{ post.comments.length }}</span>
                  </button>
                  <span v-if="unreadCommentsCount(post) > 0" class="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {{ unreadCommentsCount(post) }}
                 </span>
                </div>
              </div>
              <section v-if="post.showComments" class=" dark:bg-gray-900 antialiased">
                <div>
                  <article
                      v-for="comment in post.comments"
                      :key="comment.id"
                      :id="'comment-' + comment.id"
                      class="pt-2 p-2 text-sm  dark:bg-gray-900"
                  >
                    <footer class="flex flex-col sm:flex-row justify-between">
                      <div class="flex">
                        <div
                            class="w-8 h-8 sm:w-10 sm:h-10 rounded-full mr-2 flex-shrink-0 flex items-center justify-center bg-gray-700 text-white text-sm"
                        >
                          <img
                              v-if="getParticipantAvatar(comment.userId)"
                              :src="getParticipantAvatar(comment.userId)"
                              :alt="getParticipantName(comment.userId)"
                              class="rounded-full w-full h-full"
                          />
                          <span v-else>{{ getParticipantName(comment.userId).charAt(0).toUpperCase() }}</span>
                        </div>
                        <div>
                          <p class="text-xs text-gray-200 dark:text-white font-semibold">
                            {{ getParticipantName(comment.userId) }}
                          </p>
                          <textarea
                              v-if="editingCommentId === comment.id"
                              v-model="editedComment"
                              class="mt-1 block w-full text-xs text-gray-200 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-900"
                              required
                          >{{ comment.message }}</textarea>
                          <p v-else class="text-gray-400 dark:text-gray-400 break-words">
                            {{ comment.message }}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center space-x-1 mt-2 sm:mt-0">
                        <button @click="speakText(getParticipantName(comment.userId), comment.message)" class="text-gray-400 hover:text-indigo-400 focus:outline-none">
                          <i class="fa fa-volume-up"></i>
                        </button>
                        <div v-if="editingCommentId !== comment.id && currentUser && currentUser.uid === comment.userId">
                          <button @click="editComment(comment)" class="text-blue-400 focus:outline-none">Edit</button> |
                          <button @click="deleteComment(post, comment.id)" class="text-red-400 focus:outline-none">Delete</button>
                        </div>
                        <button v-if="editingCommentId === comment.id" @click="saveComment(post, comment)" class="text-green-400 focus:outline-none">Save</button>
                      </div>
                    </footer>
                    <!-- Reply Form -->
                    <div v-if="comment.showReplyForm" class="mt-2">
        <textarea
            v-model="replyInput[comment.id]"
            placeholder="Add a reply..."
            class="w-full p-2 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 placeholder-gray-500 text-xs"
        ></textarea>
                      <button
                          @click="addReply(post, comment)"
                          class="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded-full focus:outline-none focus:shadow-outline"
                      >
                        Submit
                      </button>
                    </div>
                    <!-- Replies -->
                    <div v-if="comment.replies && comment.replies.length > 0" class="mt-4 pl-4 border-l border-gray-700">
                      <article
                          v-for="reply in comment.replies"
                          :key="reply.id"
                          class="pt-2 p-2 text-sm bg-gray-800 dark:bg-gray-900"
                      >
                        <footer class="flex justify-between">
                          <div class="flex">
                            <div
                                class="w-6 h-6 rounded-full mr-2 flex-shrink-0 flex items-center justify-center bg-gray-700 text-white text-sm"
                            >
                              <img
                                  v-if="getParticipantAvatar(reply.userId)"
                                  :src="getParticipantAvatar(reply.userId)"
                                  :alwt="getParticipantName(reply.userId)"
                                  class="rounded-full w-full h-full"
                              />
                              <span v-else>{{ getParticipantName(reply.userId).charAt(0).toUpperCase() }}</span>
                            </div>
                            <div>
                              <p class="text-xs text-gray-200 dark:text-white font-semibold">
                                {{ getParticipantName(reply.userId) }}
                              </p>
                              <textarea
                                  v-if="editingReplyId === reply.id"
                                  v-model="editedReply"
                                  class="mt-1 block w-full text-xs text-gray-200 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-900"
                                  required
                              >{{ reply.message }}</textarea>
                              <p v-else class="text-gray-400 dark:text-gray-400 break-words">
                                {{ reply.message }}
                              </p>
                            </div>
                          </div>
                          <div class="flex items-center space-x-1">
                            <button @click="speakText(getParticipantName(reply.userId), reply.message)" class="text-gray-400 hover:text-indigo-400 focus:outline-none">
                              <i class="fa fa-volume-up"></i>
                            </button>
                            <div v-if="editingReplyId !== reply.id && currentUser && currentUser.uid === reply.userId">
                              <button @click="editReply(reply)" class="text-blue-400 focus:outline-none">Edit</button> |
                              <button @click="deleteReply(post, comment, reply.id)" class="text-red-400 focus:outline-none">Delete</button>
                            </div>
                            <button v-if="editingReplyId === reply.id" @click="saveReply(comment, reply, post)" class="text-green-400 focus:outline-none">Save</button>
                          </div>
                        </footer>
                      </article>
                    </div>
                  </article>
                </div>
              </section>



              <div class="flex items-center mb-4 mt-5 space-x-4">
                <button @click="toggleReaction(post, 'like')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'like') }">
                  <span class="reaction-icon">👍</span>
                  <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'like') }}</span>
                </button>
                <button @click="toggleReaction(post, 'love')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'love') }">
                  <span class="reaction-icon">❤️</span>
                  <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'love') }}</span>
                </button>
                <button @click="toggleReaction(post, 'laugh')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'laugh') }">
                  <span class="reaction-icon">😂</span>
                  <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-yellow-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'laugh') }}</span>
                </button>
                <button @click="toggleReaction(post, 'surprised')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'surprised') }">
                  <span class="reaction-icon">😮</span>
                  <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-green-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'surprised') }}</span>
                </button>
                <button @click="toggleReaction(post, 'sad')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'sad') }">
                  <span class="reaction-icon">😢</span>
                  <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'sad') }}</span>
                </button>
              </div>
              <div class="mb-4" v-if="post.userId === currentUser.uid">
                <div class="inline-flex space-x-2">
                  <button @click="showCreatePostModal(post)" class="text-blue-400 focus:outline-none flex items-center">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button @click="deletePost(post)" class="text-red-400 focus:outline-none flex items-center">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
              <div class="flex items-center  py-2">
  <textarea
      v-model="commentInput[post.id]"
      placeholder="Add a comment..."
      class="flex-1 rounded-full py-2 px-4 mr-2 border border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white placeholder-gray-500 resize-none"
      rows="1"
  ></textarea>
                <button
                    @click="addComment(post)"
                    class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"
                >
                  <i class="fa fa-comment"></i>
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>

    <!-- Modal for creating or editing a post -->
    <div v-if="showModal" class="fixed inset-0 overflow-y-auto flex justify-center items-center">
      <div class="fixed inset-0 bg-black opacity-50"></div>
      <div class="relative bg-gray-800 rounded-lg shadow-lg p-6 max-w-lg w-full dark:bg-gray-800 dark:text-gray-200">
        <h2 class="text-2xl text-white font-semibold mb-4">{{ editingPost ? 'Edit Post' : 'Create New Post' }}</h2>
        <form @submit.prevent="editingPost ? updatePost() : createNewPost()">
          <div class="py-2 px-4 mb-4 bg-gray-800 rounded-lg rounded-t-lg border border-gray-700 dark:bg-gray-800 ">
            <label for="postMessage" class="block text-sm font-medium text-gray-200">Message</label>
            <textarea id="postMessage" v-model="newPost.topic" rows="6" class="mt-1 block w-full text-sm text-gray-900 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-800" style="padding: 8px;" placeholder="Choose a topic to discuss" required></textarea>
          </div>
<!--          <div class="py-2 px-4 mb-4 bg-gray-800 rounded-lg border border-gray-700 dark:bg-gray-800 dark:border-gray-700">-->
<!--            <label for="postUrl" class="block text-sm font-medium text-gray-200">URL</label>-->
<!--            <input id="postUrl" v-model="newPost.url" type="text" class="mt-1 block w-full text-sm text-gray-900 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-800" placeholder="Paste URL here" required>-->
<!--          </div>-->
          <div class="flex flex-col items-center justify-center   ">
            <div class="flex items-center bg-gray-800 justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 rounded-lg shadow-md">
              <div class="flex justify-end space-x-2 ">
                <button type="submit" @click="createNewPost" class="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900 hover:bg-blue-800">
                  {{ editingPost ? 'Update' : 'Create' }}
                </button>
                <button @click="closeModal" type="button" class="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-300 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500">Cancel</button>
              </div>
              <div class="flex items-center space-x-2">
                <label for="file-upload" class="inline-flex justify-center items-center p-2 text-gray-500 rounded cursor-pointer hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600">
                  <svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
                    <path d="M18 0H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm-5.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm4.376 10.481A1 1 0 0 1 16 15H4a1 1 0 0 1-.895-1.447l3.5-7A1 1 0 0 1 7.468 6a.965.965 0 0 1 .9.5l2.775 4.757 1.546-1.887a1 1 0 0 1 1.618.1l2.541 4a1 1 0 0 1 .028 1.011Z"/>
                  </svg>
                  <span class="sr-only">Upload media</span>
                </label>
                <input id="file-upload" type="file" @change="handleFileChange" accept="image/*, video/*" class="hidden" />
              </div>
            </div>
            <div class="flex flex-col items-center w-full space-y-2">
              <div v-if="mediaType === 'image' && imageUrl">
                <img :src="imageUrl" alt="Selected Image" class="w-32 h-32 rounded-lg" />
              </div>
              <div v-else-if="mediaType === 'video' && videoUrl">
                <video :src="videoUrl" controls class="w-32 h-32 rounded-lg"></video>
              </div>
              <div v-if="uploadProgress !== null">
                <progress :value="uploadProgress" max="100" class="w-full"></progress>
                <p>Upload Progress: {{ uploadProgress }}%</p>
              </div>
            </div>
          </div>


        </form>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div class="fixed bottom-0 left-0 right-0 bg-gray-800 dark:bg-gray-900 shadow-lg py-2 flex justify-around">
      <button  class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <i class="fa fa-home w-6 h-6"></i>
        <router-link to="/"><span class="text-xs">Home</span>
        </router-link>
      </button>
      <button class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <i class="fa fa-search w-6 h-6"></i>
        <a href="#target-section" class="text-xs">Search</a>
      </button>
      <button class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <i class="fa fa-bell w-6 h-6"></i>
        <span class="text-xs">Notifications</span>
      </button>
      <button  class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <i class="fa fa-user w-6 h-6"></i>
        <router-link :to="'/profile/' + ids"><span class="text-xs">Profile</span></router-link>
      </button>
    </div>



    <!-- Floating Action Button -->
    <button @click="showCreatePostModal()" class="fixed bottom-16 right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg animate-jump">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
    </button>
<!--    <audio ref="backgroundMusic" autoplay loop>-->
<!--      <source src="@/assets/song.mp3" type="audio/mpeg">-->
<!--      Your browser does not support the audio element.-->
<!--    </audio>-->
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch} from 'vue';
import axios from 'axios';
import { db, auth, storage } from '@/firebaseConfig';
import Skeleton from "@/components/Skeleton.vue";
import { collection, getDoc, onSnapshot, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useRoute } from 'vue-router';
import { ref as storageRef, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
const audioRef = ref(null);
const previewUrl = ref('');
const fileToUpload = ref(null);

watch(audioRef, (newVal) => {
  if (newVal) {
    newVal.play();
  }
}, { immediate: true });


dayjs.extend(relativeTime);
const generateUniqueId = () => Math.random().toString(36).substr(2, 9);

const route = useRoute();
const room_id = ref(route.params.id);
const selectedRoom = ref({
  title: 'Travel Enthusiasts',
  participants: [],
  posts: []
});
const loading = ref(true);

const showModal = ref(false);
const editedComment = ref('');
const editingCommentId = ref(null);


const newPost = ref({
  topic: '',
  message: '',
  url:'',
  mediaUrl: ''
});
const editingPost = ref(null);
const commentInput = ref({});
const searchQuery = ref('');
const filteredPosts = ref([]);
const filteredParticipants = ref([]);


async function deletePost(post) {
  try {
    await deleteDoc(doc(db, 'posts', post.id));
    filteredPosts.value = filteredPosts.value.filter(p => p.id !== post.id);
  } catch (error) {
    console.error("Error deleting post: ", error);
  }
}

onMounted(() => {
  const unsubscribe = onSnapshot(collection(db, 'posts'), snapshot => {
    const posts = [];
    snapshot.forEach(doc => {
      const postData = {...doc.data(), id: doc.id};
      if (postData.room_id === room_id.value) {
        posts.push(postData);
      }
    });
    posts.sort((a, b) => b.timestamp - a.timestamp)
    selectedRoom.value.posts = posts;
    filteredPosts.value = posts;
    filteredParticipants.value = selectedRoom.value.participants;
  });
  return unsubscribe;
});

const deleteComment = async (post, commentId) => {
  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postComments = postSnapshot.data().comments;
    const filteredComments = postComments.filter(c => c.id !== commentId);
    await updateDoc(postRef, {comments: filteredComments});
  } catch (error) {
    console.error('Error deleting comment: ', error);
  }
};



const toggleLike = (item) => {
  item.liked = !item.liked;
  item.likes += item.liked ? 1 : -1;
};

const editComment = (comment) => {
  editingCommentId.value = comment.id;
  editedComment.value = comment.message;
};
const unreadCommentsCount = (post) => {
  if (!currentUser.value) return 0;

  const totalComments = post.comments.length;
  const readComments = post.readComments?.[currentUser.value.uid] || [];
  return totalComments - readComments.length;
};

const saveComment = async (post, comment) => {
  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postComments = postSnapshot.data().comments;
    const editedIndex = postComments.findIndex(c => c.id === comment.id);
    if (editedIndex !== -1) {
      postComments[editedIndex].message = editedComment.value;
      await updateDoc(postRef, {comments: postComments});
      editingCommentId.value = null;
      editedComment.value = '';
    }
  } catch (error) {
    console.error('Error updating comment: ', error);
  }
};

const toggleCommentSection = async (post) => {
  post.showComments = !post.showComments;
  if (post.showComments && currentUser.value) {
    try {
      const postRef = doc(db, 'posts', post.id);
      const postSnapshot = await getDoc(postRef);
      const postReadComments = postSnapshot.data().readComments || {};
      const userReadComments = postReadComments[currentUser.value.uid] || [];

      const newReadComments = post.comments
          .map(comment => comment.id)
          .filter(commentId => !userReadComments.includes(commentId));

      if (newReadComments.length > 0) {
        await updateDoc(postRef, {
          [`readComments.${currentUser.value.uid}`]: arrayUnion(...newReadComments)
        });
      }
    } catch (error) {
      console.error('Error updating read comments:', error);
    }
  }
};

const toggleReaction = async (post, reaction) => {
  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postReactions = postSnapshot.data().reactions || {};
    if (postReactions[currentUser.value.uid] === reaction) {
      delete postReactions[currentUser.value.uid];
    } else {
      postReactions[currentUser.value.uid] = reaction;
    }
    await updateDoc(postRef, {reactions: postReactions});
    post.reactions = postReactions;
  } catch (error) {
    console.error('Error toggling reaction: ', error);
  }
};

const hasReaction = (post, reaction) => {
  const postReactions = post.reactions || {};
  return postReactions[currentUser.value.uid] === reaction;
};

const getReactionCount = (post, reaction) => {
  const postReactions = post.reactions || {};
  return Object.values(postReactions).filter(r => r === reaction).length;
};

const showCreatePostModal = (post = null) => {
  showModal.value = true;
  if (post) {
    editingPost.value = post;
    newPost.value.topic = post.topic;
    newPost.value.message = post.message;
  } else {
    editingPost.value = null;
    newPost.value.topic = '';
    newPost.value.message = '';
  }
};

const closeModal = () => {
  showModal.value = false;
  newPost.value = {topic: '', message: ''};
  editingPost.value = null;
};
const currentUser = ref(null);
const ids = ref(null)
onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser.value = user;
      ids.value = user.uid
    } else {
      currentUser.value = null;
    }
  });
});
const extractYouTubeId = (url) => {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const extractTikTokId = (url) => {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([^/]+)\/video\/(\d+)/);
  return match ? match[2] : null;
};



let isCreatingPost = false;

const createNewPost = async () => {
  if (isCreatingPost) {
    console.log('Post creation in progress, please wait.');
    return;
  }

  isCreatingPost = true;

  const userId = currentUser.value ? currentUser.value.uid : null;
  if (!userId) {
    console.error('User is not signed in');
    isCreatingPost = false;
    return;
  }

  if (!newPost.value.topic) {
    console.error('Topic is required to create a new post');
    isCreatingPost = false;
    return;
  }

  let mediaUrl = '';
  if (fileToUpload.value) {
    try {
      mediaUrl = await uploadFile(fileToUpload.value);
    } catch (error) {
      console.error('Error uploading file: ', error);
      isCreatingPost = false;
      return;
    }
  }

  console.log('Media URL:', mediaUrl);

  const newPostData = {
    userId,
    room_id: room_id.value,
    topic: newPost.value.topic,
    message: newPost.value.message,
    mediaUrl,
    timestamp: serverTimestamp(),
    liked: false,
    likes: 0,
    showComments: false,
    comments: []
  };

  try {
    const docRef = await addDoc(collection(db, 'posts'), newPostData);
    closeModal();
    const userName = getParticipantName(newPostData.userId);
    await sendNotification(`created a new post: ${newPostData.topic}`, userName, docRef.id, null, newPostData.message);
    setTimeout(() => {
      const postElement = document.getElementById(`post-${docRef.id}`);
      if (postElement) {
        postElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 500);
  } catch (error) {
    console.error('Error adding new post to Firestore: ', error);
  } finally {
    isCreatingPost = false;
  }
};



const sendNotification = async (message, userName, postId, commentId = null, content = '') => {
  const headers = {
    'Authorization': 'Bearer token="ZWY3MWJhMDUtNTU1Yi00NGViLThmNjItNDNhZTY0YzMwOGRh"',
    'Content-Type': 'application/json'
  };

  let notificationMessage = `${userName} ${message}`;
  if (content) {
    notificationMessage += `: ${content}`;
  }

  const data = {
    "app_id": "65d866ad-f59c-4557-9d75-4ccf7fe60a47",
    "included_segments": ["All"],
    "data": {"foo": "bar"},
    "contents": {"en": notificationMessage}
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {headers});
    console.log('Notification sent:', response.data);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const updatePost = async () => {
  if (editingPost.value) {
    const postRef = doc(db, 'posts', editingPost.value.id);
    await updateDoc(postRef, {
      topic: newPost.value.topic,
      message: newPost.value.message
    });
  }
  closeModal();
};

const addComment = async (post) => {
  const userId = currentUser.value ? currentUser.value.uid : null;
  const comment = {
    userId,
    message: commentInput.value[post.id],
    timestamp: new Date().toLocaleTimeString(),
    id: generateUniqueId()
  };

  try {
    await updateDoc(doc(db, 'posts', post.id), {comments: arrayUnion(comment)});
    commentInput.value[post.id] = '';
    const userName = getParticipantName(userId);
    await sendNotification('commented on a post.', userName, post.id, comment.id, comment.message);
    // Scroll to the new comment
    setTimeout(() => {
      const commentElement = document.getElementById(`comment-${comment.id}`);
      if (commentElement) {
        commentElement.scrollIntoView({behavior: 'smooth'});
      }
    }, 500);
  } catch (e) {
    console.error('Error adding comment: ', e);
  }
};

const speakText = (username, message) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(`${username} says: ${message}`);
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Text-to-speech not supported in this browser.');
  }
};

const getParticipantAvatar = (userId) => {
  const participant = selectedRoom.value.participants.find(p => p.id === userId);
  return participant ? participant.avatar : '';
};

const getParticipantName = (userId) => {
  const participant = selectedRoom.value.participants.find(p => p.id === userId);
  return participant ? participant.name : '';
};



const formatTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp.seconds !== 'number') {
    // Handle the case where the timestamp is null, undefined, or doesn't have the 'seconds' property
    return 'Invalid timestamp';
  }

  const seconds = timestamp.seconds;
  const milliseconds = seconds * 1000 + Math.round(timestamp.nanoseconds / 1000000);
  return dayjs(milliseconds).fromNow();
};


const fetchRoomData = async () => {
  try {
    const roomId = room_id.value
    const roomDoc = await getDoc(doc(db, 'rooms', roomId));
    if (roomDoc.exists()) {
      const roomData = roomDoc.data();
      const approvedUsers = roomData.approvedUsers;

      const querySnapshot = await getDocs(collection(db, 'users'));
      querySnapshot.forEach(doc => {
        if (approvedUsers.includes(doc.id)) {
          selectedRoom.value.participants.push(doc.data());
        }
      });
    }
    loading.value = false;
  } catch (error) {
    console.error('Error fetching room data:', error);
    loading.value = false;
  }
};
onMounted(async () => {
  await fetchRoomData();
});


const showMore = ref(false);
const visibleParticipants = computed(() => {
  return showMore.value ? selectedRoom.value.participants : selectedRoom.value.participants.slice(0, 3);
});

const toggleShowMore = () => {
  showMore.value = !showMore.value;
};
const replyInput = ref({});
const editingReplyId = ref(null);
const editedReply = ref('');
const toggleReplyForm = (comment) => {
  comment.showReplyForm = !comment.showReplyForm;
};

const deleteReply = async (post, comment, replyId) => {
  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postComments = postSnapshot.data().comments;
    const commentIndex = postComments.findIndex(c => c.id === comment.id);
    if (commentIndex !== -1) {
      const replyIndex = postComments[commentIndex].replies.findIndex(r => r.id === replyId);
      if (replyIndex !== -1) {
        postComments[commentIndex].replies.splice(replyIndex, 1);
        await updateDoc(postRef, { comments: postComments });
      }
    }
  } catch (error) {
    console.error('Error deleting reply: ', error);
  }
};

const editReply = (reply) => {
  editingReplyId.value = reply.id;
  editedReply.value = reply.message;
};

const saveReply = async (comment, reply, post) => {
  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postComments = postSnapshot.data().comments;
    const commentIndex = postComments.findIndex(c => c.id === comment.id);
    if (commentIndex !== -1) {
      const replyIndex = postComments[commentIndex].replies.findIndex(r => r.id === reply.id);
      if (replyIndex !== -1) {
        postComments[commentIndex].replies[replyIndex].message = editedReply.value;
        await updateDoc(postRef, { comments: postComments });
        editingReplyId.value = null;
        editedReply.value = '';
      }
    }
  } catch (error) {
    console.error('Error saving reply: ', error);
  }
};

const addReply = async (post, comment) => {
  if (!replyInput.value[comment.id]) return;

  const newReply = {
    id: Date.now().toString(),
    userId: currentUser.value.uid,
    message: replyInput.value[comment.id],
    timestamp: new Date().toISOString()
  };

  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postComments = postSnapshot.data().comments;
    const commentIndex = postComments.findIndex(c => c.id === comment.id);
    if (commentIndex !== -1) {
      if (!postComments[commentIndex].replies) {
        postComments[commentIndex].replies = [];
      }
      postComments[commentIndex].replies.push(newReply);
      await updateDoc(postRef, { comments: postComments });
      replyInput.value[comment.id] = '';

      const userName = getParticipantName(currentUser.value.uid);
      await sendNotification('replied to a comment.', userName, post.id, comment.id, newReply.message);
    }
  } catch (error) {
    console.error('Error adding reply: ', error);
  }
};

const imageUrl = ref('');
const videoUrl = ref('');
const mediaType = ref('');
const uploadProgress = ref(null);

const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    fileToUpload.value = file;
    mediaType.value = file.type.startsWith('image/') ? 'image' : 'video';

    const reader = new FileReader();
    reader.onload = (e) => {
      if (mediaType.value === 'image') {
        imageUrl.value = e.target.result;
      } else {
        videoUrl.value = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  }
};



function isVideoUrl(url) {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];
  const urlParts = url.split('?')[0].split('.');
  const extension = urlParts[urlParts.length - 1].toLowerCase();
  return videoExtensions.includes(`.${extension}`);
}

const uploadFile = async (file) => {
  if (!file) return null;
  const storageReference = storageRef(storage, `uploads/${file.name}`);
  const uploadTask = uploadBytesResumable(storageReference, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          uploadProgress.value = progress;
        },
        (error) => {
          console.error('Upload failed', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('File available at', downloadURL);
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL', error);
            reject(error);
          }
        }
    );
  });
};
const removeImage = () => {
  imageUrl.value = null;
};

const removeVideo = () => {
  videoUrl.value = null;
};

</script>

<style>
@keyframes jump {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

.animate-jump {
  animation: jump 2.5s ease-in-out infinite;
}
</style>
