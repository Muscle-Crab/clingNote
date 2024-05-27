<template>
  <!-- Main wrapper for the entire app -->
  <div class="min-h-screen bg-gray-900 dark:bg-[#1c1c1e]">
    <!-- Container for the entire room -->
    <div class="container mx-auto px-4 py-1 pt-10">
      <!-- Search Bar -->
      <div class="mb-6">
        <input
            v-model="searchQuery"
            @input="searchContent"
            type="text"
            placeholder="Search for posts or participants..."
            class="w-full p-4 rounded-lg border border-gray-600 bg-gray-800 text-gray-200 placeholder-gray-500"
        />
      </div>
      <div class="mb-6">
        <h2 class="text-2xl font-bold mb-4 text-white">Example Posts</h2>
        <div class="mb-6">
          <div class="flex space-x-2 overflow-x-auto">
            <div v-for="story in stories" :key="story.id" class="relative bg-gray-800 dark:bg-gray-800 rounded-lg shadow-lg w-40 h-32 flex-shrink-0 flex items-center justify-center p-1 border-2 border-indigo-500">
              <div class="text-gray-200 text-sm text-center">
                {{ story.text }}
              </div>
            </div>
          </div>
        </div>

      </div>



      <!-- Grid layout for different sections -->
      <div v-if="loading" class="animate-pulse">
        <!-- Skeleton Loader for Participants -->
        <div class="col-span-1 bg-gray-800 rounded-lg shadow-md p-6 mb-8 dark:bg-gray-800 item-start">
          <h2 class="text-xl font-semibold text-gray-200 mb-4">Participants</h2>
          <ul class="space-y-4">
            <li class="flex items-center">
              <div class="w-12 h-12 bg-gray-600 rounded-full mr-4"></div>
              <div class="h-4 bg-gray-600 rounded w-24"></div>
            </li>
            <li class="flex items-center">
              <div class="w-12 h-12 bg-gray-600 rounded-full mr-4"></div>
              <div class="h-4 bg-gray-600 rounded w-24"></div>
            </li>
            <li class="flex items-center">
              <div class="w-12 h-12 bg-gray-600 rounded-full mr-4"></div>
              <div class="h-4 bg-gray-600 rounded w-24"></div>
            </li>
          </ul>
        </div>

        <!-- Skeleton Loader for Posts -->
        <div class="col-span-2 grid grid-cols-1 gap-8">
          <div class="md:min-w-[320px]">
            <div class="min-w-sm p-6 bg-gray-600 border border-gray-500 rounded-lg shadow dark:bg-gray-800">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                  <div class="w-12 h-12 bg-gray-600 rounded-full mr-2"></div>
                  <div class="h-4 bg-gray-600 rounded w-24"></div>
                </div>
              </div>
              <div class="h-4 bg-gray-600 rounded mb-2"></div>
              <div class="h-4 bg-gray-600 rounded mb-2"></div>
              <div class="h-4 bg-gray-600 rounded mb-4"></div>
              <div class="flex justify-between items-center">
                <div class="h-6 bg-gray-600 rounded w-12"></div>
                <div class="h-6 bg-gray-600 rounded w-12"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Skeleton Loader for Actions -->
        <div class="col-span-1 bg-gray-800 rounded-lg shadow-md p-6 dark:bg-gray-800">
          <h2 class="text-xl font-semibold text-gray-200 mb-4">Actions</h2>
          <div class="h-12 bg-gray-600 rounded mb-4"></div>
          <div class="h-12 bg-gray-600 rounded mb-4"></div>
          <div class="h-12 bg-gray-600 rounded mb-4"></div>
        </div>
      </div>

      <!-- Actual Content -->
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Left Sidebar: Participants -->
        <div class="col-span-1 bg-gray-800 rounded-lg shadow-md p-6 dark:bg-gray-800">
          <h2 class="text-xl font-semibold text-gray-200 mb-4">Participants</h2>
          <ul class="space-y-4">
            <li v-for="participant in selectedRoom.participants" :key="participant.id" class="flex items-center">
              <div class="w-12 h-12 rounded-full mr-4 flex items-center justify-center bg-gray-700 text-white text-xl">
                <img v-if="participant.avatar" :src="participant.avatar" alt="Participant" class="rounded-full w-full h-full">
                <span v-else>{{ participant.name.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="text-gray-200">{{ participant.name }}</span>
            </li>
          </ul>
        </div>

        <!-- Main Content: Posts -->
        <div class="col-span-2 grid grid-cols-1 gap-8">
          <div v-for="post in filteredPosts" :key="post.id" :id="'post-' + post.id" class="md:min-w-[320px]">
            <div class="min-w-sm p-6 bg-gray-800 border border-gray-700 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                  <div class="w-12 h-12 rounded-full mr-2 flex items-center justify-center bg-gray-700 text-white text-xl">
                    <img v-if="getParticipantAvatar(post.userId)" :src="getParticipantAvatar(post.userId)" alt="User" class="rounded-full w-full h-full">
                    <span v-else>{{ getParticipantName(post.userId).charAt(0).toUpperCase() }}</span>
                  </div>
                  <span class="font-semibold text-gray-200">{{ getParticipantName(post.userId) }}</span>
                </div>
              </div>
              <a href="#">
                <h5 class="mb-2 font-bold tracking-tight text-gray-200 dark:text-white">{{ post.topic }}</h5>
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
                <div>
                  <button @click="toggleCommentSection(post)" class="flex items-center text-blue-400 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l3 3m-3-3l-3 3m3-3H3a2 2 0 01-2-2V5a2 2 0 012-2h18a2 2 0 012 2v10a2 2 0 01-2 2h-8l-3 3z"></path>
                    </svg>
                    <span>{{ post.comments.length }}</span>
                  </button>
                </div>
              </div>
              <section v-if="post.showComments" class="bg-gray-800 dark:bg-gray-900 antialiased">
                <div>
                  <article v-for="comment in post.comments" :key="comment.id" :id="'comment-' + comment.id" class="pt-4 md:p-4 text-base bg-gray-800 dark:bg-gray-900">
                    <footer class="flex flex-col md:flex-row justify-between">
                      <div class="flex">
                        <div class="w-12 h-12 md:w-12 md:h-12 rounded-full mr-3 flex items-center justify-center bg-gray-700 text-white text-xl">
                          <img v-if="getParticipantAvatar(comment.userId)" :src="getParticipantAvatar(comment.userId)" :alt="getParticipantName(comment.userId)" class="rounded-full w-full h-full">
                          <span v-else>{{ getParticipantName(comment.userId).charAt(0).toUpperCase() }}</span>
                        </div>
                        <div>
                          <p class="text-sm text-gray-200 dark:text-white font-semibold">{{ getParticipantName(comment.userId) }}</p>
                          <textarea v-if="editingCommentId === comment.id" v-model="editedComment" class="mt-1 block w-full text-sm text-gray-200 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-900" required>{{ comment.message }}</textarea>
                          <p v-else class="text-gray-400 dark:text-gray-400">{{ comment.message }}</p>
                        </div>
                      </div>
                      <div class="flex items-center space-x-2">
                        <button @click="speakText(comment.message)" class="text-gray-400 hover:text-indigo-400 focus:outline-none">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 3a1 1 0 01.993.883L11 4v12a1 1 0 01-1.993.117L9 16V4a1 1 0 011-1zm5.707 2.293a1 1 0 011.5 1.32l-.083.094-3.25 3.25a1 1 0 01-1.32.083l-.094-.083-3.25-3.25a1 1 0 011.32-1.497l.094.083L12 7.086l3.207-3.293z" />
                          </svg>
                        </button>
                        <div v-if="editingCommentId !== comment.id && currentUser && currentUser.uid === comment.userId">
                          <button @click="editComment(comment)" class="text-blue-400 focus:outline-none">Edit</button> |
                          <button @click="deleteComment(post, comment.id)" class="text-red-400 focus:outline-none">Delete</button>
                        </div>
                        <button v-if="editingCommentId === comment.id" @click="saveComment(post, comment)" class="text-green-400 focus:outline-none">Save</button>
                      </div>
                    </footer>
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
              <div class="mb-4">
                <button @click="showCreatePostModal(post)" class="text-blue-400 focus:outline-none">Edit Post</button>
              </div>
              <div class="flex items-center border-t border-gray-700 py-2">
                <input
                    v-model="commentInput[post.id]"
                    type="text"
                    placeholder="Add a comment..."
                    class="flex-1 rounded-full py-2 px-4 mr-2 border border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 bg-gray-800 text-white placeholder-gray-500"
                />
                <button @click="addComment(post)" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"><i class="fa fa-comment"></i></button>
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
        <h2 class="text-2xl font-semibold mb-4">{{ editingPost ? 'Edit Post' : 'Create New Post' }}</h2>
        <form @submit.prevent="editingPost ? updatePost() : createNewPost()">
          <div class="py-2 px-4 mb-4 bg-gray-800 rounded-lg rounded-t-lg border border-gray-700 dark:bg-gray-800 dark:border-gray-700">
            <label for="postMessage" class="block text-sm font-medium text-gray-200">Message</label>
            <textarea id="postMessage" v-model="newPost.topic" rows="6" class="mt-1 block w-full text-sm text-gray-200 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-800" placeholder="choose a topic to discuss" required></textarea>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{{ editingPost ? 'Update' : 'Create' }}</button>
            <button @click="closeModal" type="button" class="ml-2 bg-gray-500 hover:bg-gray-600 text-gray-200 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
    <!-- Bottom Navigation Bar -->
    <div class="fixed bottom-0 left-0 right-0 bg-gray-800 dark:bg-gray-900 shadow-lg py-2 flex justify-around">
      <button @click="navigateTo('home')" class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 12l2-2 7-7 7 7 2 2h-5v6h-8v-6H3z"/>
        </svg>
        <span class="text-xs">Home</span>
      </button>
      <button @click="navigateTo('search')" class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 21l-6-6m2-3a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
        </svg>
        <span class="text-xs">Search</span>
      </button>
      <button @click="navigateTo('notifications')" class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 17h5l-1.405-1.405M18 10a6 6 0 1 0-12 0 6 6 0 0 0 12 0z"/>
        </svg>
        <span class="text-xs">Notifications</span>
      </button>
      <button @click="navigateTo('profile')" class="flex flex-col items-center text-gray-400 dark:text-gray-300 hover:text-indigo-400 dark:hover:text-indigo-500">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM2 20c0-2.21 1.79-4 4-4h12c2.21 0 4 1.79 4 4v2H2v-2z"/>
        </svg>
        <span class="text-xs">Profile</span>
      </button>
    </div>


    <!-- Floating Action Button -->
    <button @click="showCreatePostModal()" class="fixed bottom-16 right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { db, auth } from '@/firebaseConfig';
import { formatDistanceToNow } from 'date-fns';
import { collection, getDoc, onSnapshot, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useRoute } from 'vue-router';

const generateUniqueId = () => Math.random().toString(36).substr(2, 9);

const route = useRoute();
const room_id = ref(route.params.id);
const selectedRoom = ref({
  title: 'Travel Enthusiasts',
  participants: [],
  posts: []
});
const loading = ref(true);
onMounted(async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    querySnapshot.forEach(doc => {
      selectedRoom.value.participants.push(doc.data());
    });
    loading.value = false;
  } catch (error) {
    console.error('Error fetching participants:', error);
    loading.value = false;
  }
});
const showModal = ref(false);
const editedComment = ref('');
const editingCommentId = ref(null);

const formatTimestampToAgo = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp.toDate();
  return formatDistanceToNow(date, {addSuffix: true, includeSeconds: true}).replace('about ', '');
};
const newPost = ref({
  topic: '',
  message: ''
});
const editingPost = ref(null);
const commentInput = ref({});
const searchQuery = ref('');
const filteredPosts = ref([]);
const filteredParticipants = ref([]);

const searchContent = () => {
  const query = searchQuery.value.toLowerCase();
  filteredPosts.value = selectedRoom.value.posts.filter(post => post.topic.toLowerCase().includes(query) || post.message.toLowerCase().includes(query));
  filteredParticipants.value = selectedRoom.value.participants.filter(participant => participant.name.toLowerCase().includes(query));
};

onMounted(() => {
  const unsubscribe = onSnapshot(collection(db, 'posts'), snapshot => {
    const posts = [];
    snapshot.forEach(doc => {
      const postData = {...doc.data(), id: doc.id};
      if (postData.room_id === room_id.value) {
        posts.push(postData);
      }
    });
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

const leaveRoom = () => {
  console.log('Left the room');
};

const shareRoom = () => {
  console.log('Shared the room');
};

const toggleLike = (item) => {
  item.liked = !item.liked;
  item.likes += item.liked ? 1 : -1;
};

const editComment = (comment) => {
  editingCommentId.value = comment.id;
  editedComment.value = comment.message;
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

const toggleCommentSection = (item) => {
  item.showComments = !item.showComments;
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

onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser.value = user;
    } else {
      currentUser.value = null;
    }
  });
});

const createNewPost = async () => {
  const userId = currentUser.value ? currentUser.value.uid : null;
  if (!userId) {
    console.error('User is not signed in');
    return;
  }
  const newPostData = {
    userId,
    room_id: room_id.value,
    topic: newPost.value.topic,
    message: newPost.value.message,
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
    await sendNotification('created a new post.', userName, docRef.id);
    // Scroll to the new post
    setTimeout(() => {
      const postElement = document.getElementById(`post-${docRef.id}`);
      if (postElement) {
        postElement.scrollIntoView({behavior: 'smooth'});
      }
    }, 500);
  } catch (error) {
    console.error('Error adding new post to Firestore: ', error);
  }
};

const sendNotification = async (message, userName) => {
  const headers = {
    'Authorization': 'Bearer token="ZWY3MWJhMDUtNTU1Yi00NGViLThmNjItNDNhZTY0YzMwOGRh"',
    'Content-Type': 'application/json'
  };
  const notificationMessage = `${userName} ${message}`;
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
    await sendNotification('commented on a post.', userName, post.id, comment.id);
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
const speakText = (text) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
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
const stories = ref([
  { id: 1, text: 'If you could have dinner with any celebrity, who would it be?' },
  { id: 2, text: 'What is your favorite movie and why?' },
  { id: 3, text: 'If you could instantly master any musical instrument, which one would you choose?' },
  { id: 4, text: 'What is your go-to comfort food?' },
  { id: 5, text: 'If you could visit any country in the world, where would you go?' },
]);
const getPostComments = (post) => post.comments;

const getPostCommentsCount = (post) => post.comments.length;

const allComments = selectedRoom.value.posts.reduce((acc, post) => acc.concat(post.comments), []);
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
