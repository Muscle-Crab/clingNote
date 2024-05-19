<template>
  <!-- Container for the entire room -->
  <div class="container mx-auto px-4 py-1">
    <!-- Grid layout for different sections -->
    <div v-if="loading" class="animate-pulse">
      <!-- Skeleton Loader for Participants -->
      <div class="col-span-1 bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Participants</h2>
        <ul class="space-y-4">
          <li class="flex items-center">
            <div class="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
            <div class="h-4 bg-gray-300 rounded w-24"></div>
          </li>
          <li class="flex items-center">
            <div class="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
            <div class="h-4 bg-gray-300 rounded w-24"></div>
          </li>
          <li class="flex items-center">
            <div class="w-12 h-12 bg-gray-300 rounded-full mr-4"></div>
            <div class="h-4 bg-gray-300 rounded w-24"></div>
          </li>
        </ul>
      </div>

      <!-- Skeleton Loader for Posts -->
      <div class="col-span-2 grid grid-cols-1 gap-8">
        <div class="md:min-w-[320px]">
          <div class="min-w-sm p-6 bg-gray-300 border border-gray-200 rounded-lg shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center">
                <div class="w-12 h-12 bg-gray-300 rounded-full mr-2"></div>
                <div class="h-4 bg-gray-300 rounded w-24"></div>
              </div>
            </div>
            <div class="h-4 bg-gray-300 rounded mb-2"></div>
            <div class="h-4 bg-gray-300 rounded mb-2"></div>
            <div class="h-4 bg-gray-300 rounded mb-4"></div>
            <div class="flex justify-between items-center">
              <div class="h-6 bg-gray-300 rounded w-12"></div>
              <div class="h-6 bg-gray-300 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skeleton Loader for Actions -->
      <div class="col-span-1 bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Actions</h2>
        <div class="h-12 bg-gray-300 rounded mb-4"></div>
        <div class="h-12 bg-gray-300 rounded mb-4"></div>
        <div class="h-12 bg-gray-300 rounded mb-4"></div>
      </div>
    </div>

    <!-- Actual Content -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <!-- Left Sidebar: Participants -->
      <div class="col-span-1 bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Participants</h2>
        <ul class="space-y-4">
          <li v-for="participant in selectedRoom.participants" :key="participant.id" class="flex items-center">
            <img :src="participant.avatar" alt="Participant" class="w-12 h-12 rounded-full mr-4">
            <span class="text-gray-800">{{ participant.name }}</span>
          </li>
        </ul>
      </div>

      <!-- Main Content: Posts -->
      <div class="col-span-2 grid grid-cols-1 gap-8">
        <div v-for="post in selectedRoom.posts" :key="post.id" class="md:min-w-[320px]">
          <div class="min-w-sm p-6 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center">
                <img :src="getParticipantAvatar(post.userId)" alt="User" class="w-12 h-12 rounded-full mr-2">
                <span class="font-semibold text-gray-800">{{ getParticipantName(post.userId) }}</span>
              </div>
            </div>
            <a href="#">
              <h5 class="mb-2 font-bold tracking-tight text-gray-900 dark:text-white">{{ post.topic }}</h5>
            </a>
            <p class="text-gray-700 mb-4">{{ post.message }}</p>
            <div class="flex justify-between items-center">
              <div>
                <button @click="toggleLike(post)" class="flex items-center text-blue-500 focus:outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                  <span>{{ post.likes }}</span>
                </button>
              </div>
              <div>
                <button @click="toggleCommentSection(post)" class="flex items-center text-blue-500 focus:outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l3 3m-3-3l-3 3m3-3H3a2 2 0 01-2-2V5a2 2 0 012-2h18a2 2 0 012 2v10a2 2 0 01-2 2h-8l-3 3z"></path>
                  </svg>
                  <span>{{ post.comments.length }}</span>
                </button>
              </div>
            </div>
            <section v-if="post.showComments" class="bg-white dark:bg-gray-900 antialiased">
              <div>
                <article v-for="comment in post.comments" :key="comment.id" class="pt-4 md:p-4 text-base bg-white">
                  <footer class="flex flex-col md:flex-row justify-between">
                    <div class="flex">
                      <img class="w-12 h-12 md:w-12 md:h-12 rounded-full mr-3" :src="getParticipantAvatar(comment.userId)" :alt="getParticipantName(comment.userId)">
                      <div>
                        <p class="text-sm text-gray-900 dark:text-white font-semibold">{{ getParticipantName(comment.userId) }}</p>
                        <textarea v-if="editingCommentId === comment.id" v-model="editedComment" class="mt-1 block w-full text-sm text-gray-900 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-800" required>{{ comment.message }}</textarea>
                        <p v-else class="text-gray-500 dark:text-gray-400">{{ comment.message }}</p>
                      </div>
                    </div>
                    <div>
                      <div v-if="editingCommentId !== comment.id && currentUser && currentUser.uid === comment.userId">
                        <button @click="editComment(comment)" class="text-blue-500 focus:outline-none">Edit</button> |
                        <button @click="deleteComment(post, comment.id)" class="text-red-500 focus:outline-none">Delete</button>
                      </div>
                      <button v-if="editingCommentId === comment.id" @click="saveComment(post, comment)" class="text-green-500 focus:outline-none">Save</button>
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
              <button @click="showCreatePostModal(post)" class="text-blue-500 focus:outline-none">Edit Post</button>
            </div>
            <div class="flex items-center border-t border-gray-200 py-2">
              <input v-model="commentInput[post.id]" type="text" placeholder="Add a comment..." class="flex-1 rounded-full py-2 px-4 mr-2 border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
              <button @click="addComment(post)" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"><i class="fa fa-comment"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Sidebar: Actions -->
      <div class="col-span-1 bg-white rounded-lg shadow-md p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Actions</h2>
        <button @click="leaveRoom" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4">Leave Room</button>
        <button @click="shareRoom" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4">Share Room</button>
        <button @click="showCreatePostModal()" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Create New Post</button>
      </div>
    </div>
  </div>

  <!-- Modal for creating or editing a post -->
  <div v-if="showModal" class="fixed inset-0 overflow-y-auto flex justify-center items-center">
    <div class="fixed inset-0 bg-black opacity-50"></div>
    <div class="relative bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
      <h2 class="text-2xl font-semibold mb-4">{{ editingPost ? 'Edit Post' : 'Create New Post' }}</h2>
      <form @submit.prevent="editingPost ? updatePost() : createNewPost()">
        <div class="py-2 px-4 mb-4 bg-white rounded-lg rounded-t-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <label for="postMessage" class="block text-sm font-medium text-gray-700">Message</label>
          <textarea id="postMessage" v-model="newPost.topic" rows="6" class="mt-1 block w-full text-sm text-gray-900 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-800" placeholder="choose a topic to discuss" required></textarea>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">{{ editingPost ? 'Update' : 'Create' }}</button>
          <button @click="closeModal" type="button" class="ml-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Cancel</button>
        </div>
      </form>
    </div>
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
  return formatDistanceToNow(date, { addSuffix: true, includeSeconds: true }).replace('about ', '');
};
const newPost = ref({
  topic: '',
  message: ''
});
const editingPost = ref(null);
const commentInput = ref({});

onMounted(() => {
  const unsubscribe = onSnapshot(collection(db, 'posts'), snapshot => {
    const posts = [];
    snapshot.forEach(doc => {
      const postData = { ...doc.data(), id: doc.id };
      if (postData.room_id === room_id.value) {
        posts.push(postData);
      }
    });
    selectedRoom.value.posts = posts;
  });
  return unsubscribe;
});

const deleteComment = async (post, commentId) => {
  try {
    const postRef = doc(db, 'posts', post.id);
    const postSnapshot = await getDoc(postRef);
    const postComments = postSnapshot.data().comments;
    const filteredComments = postComments.filter(c => c.id !== commentId);
    await updateDoc(postRef, { comments: filteredComments });
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
      await updateDoc(postRef, { comments: postComments });
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
    await updateDoc(postRef, { reactions: postReactions });
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
  newPost.value = { topic: '', message: '' };
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
    await sendNotification('created a new post.', userName);
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
    "data": { "foo": "bar" },
    "contents": { "en": notificationMessage }
  };

  try {
    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
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
    await updateDoc(doc(db, 'posts', post.id), { comments: arrayUnion(comment) });
    commentInput.value[post.id] = '';
    const userName = getParticipantName(userId);
    await sendNotification('commented on a post.', userName);
  } catch (e) {
    console.error('Error adding comment: ', e);
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

const getPostComments = (post) => post.comments;

const getPostCommentsCount = (post) => post.comments.length;

const allComments = selectedRoom.value.posts.reduce((acc, post) => acc.concat(post.comments), []);
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
