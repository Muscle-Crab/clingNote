<template>
  <!-- Container for the entire room -->
  <div class="container mx-auto px-4 py-8">
    <!-- Room title -->
    <h1 class="text-3xl font-bold text-gray-800 mb-12">Room: {{ selectedRoom.title }}</h1>

    <!-- Grid layout for different sections -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <!-- Left Sidebar: Participants -->
      <div class="col-span-1 bg-white rounded-lg shadow-md p-6">
        <!-- Title for participants section -->
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Participants</h2>
        <!-- List of participants -->
        <ul class="space-y-4">
          <!-- Displaying each participant -->
          <li v-for="participant in selectedRoom.participants" :key="participant.id" class="flex items-center">
            <img :src="participant.avatar" alt="Participant" class="w-10 h-10 rounded-full mr-4">
            <span class="text-gray-800">{{ participant.name }}</span>
          </li>
        </ul>
      </div>

      <!-- Main Content: Posts -->
      <div class="col-span-2 bg-white rounded-lg shadow-md p-6">
        <!-- Title for posts section -->
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Podcast Topics</h2>
        <!-- Loop through each post -->
        <div v-for="post in selectedRoom.posts" :key="post.id" class="mb-8">
          <!-- Post -->
          <div class="bg-gray-100 rounded-lg p-4 mb-4">
            <!-- Post author and timestamp -->
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <img :src="getParticipantAvatar(post.userId)" alt="User" class="w-8 h-8 rounded-full mr-2">
                <span class="font-semibold text-gray-800">{{ getParticipantName(post.userId) }}</span>
              </div>
              <span class="text-gray-600">{{ post.timestamp }}</span>
            </div>
            <!-- Post topic and message -->
            <h3 class="text-lg font-semibold text-gray-800 mt-2">{{ post.topic }}</h3>
            <!-- Like and Comment Section -->
            <div class="flex justify-between mt-4 items-center">
              <!-- Like button -->
              <div>
                <button @click="toggleLike(post)" class="text-blue-500 focus:outline-none">{{ post.liked ? 'Unlike' : 'Like' }}</button>
                <span class="text-gray-600 ml-2">{{ post.likes }} Likes</span>
              </div>
              <!-- Delete button -->
              <div class="flex justify-end mt-2">
                <button @click="deletePost(post.id)" class="text-red-500 hover:text-red-700 focus:outline-none">Delete</button>
              </div>
              <!-- Comment button -->
              <div>
                <button @click="toggleCommentSection(post)" class="text-blue-500 focus:outline-none">{{ post.showComments ? 'Hide Comments' : 'Show Comments' }}</button>
                <span class="text-gray-600 ml-2">{{ post.comments.length }} Comments</span>
              </div>
            </div>
            <!-- Comments Section -->
            <div v-if="post.showComments" class="mt-4">
              <div v-for="comment in post.comments" :key="comment.id" class="bg-gray-200 rounded-lg p-2 mb-2">
                <!-- Comment author and timestamp -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <img :src="getParticipantAvatar(comment.userId)" alt="User" class="w-6 h-6 rounded-full mr-2">
                    <span class="font-semibold text-gray-800">{{ getParticipantName(comment.userId) }}</span>
                  </div>
                  <span class="text-gray-600">{{ comment.timestamp }}</span>
                </div>
                <!-- Comment message -->
                <p class="text-gray-700" v-if="comment.id !== editingCommentId">{{ comment.message }}</p>
                <div v-else>
                  <!-- Edit mode for comment -->
                  <input type="text" v-model="editedComment" class="w-full rounded border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
                  <div class="flex justify-end mt-1">
                    <button @click="cancelEditComment" class="text-gray-500 focus:outline-none mr-2">Cancel</button>
                    <button @click="saveEditedComment(post.id, comment.id)" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded focus:outline-none">Save</button>
                  </div>
                </div>
                <!-- Edit and Delete buttons for comments -->
                <div v-if="comment.userId === 1 && comment.id !== editingCommentId" class="mt-1 flex justify-end">
                  <button @click="editComment(comment.id)" class="text-blue-500 focus:outline-none mr-2">Edit</button>
                  <button @click="deleteComment(post.id, comment.id)" class="text-red-500 hover:text-red-700 focus:outline-none">Delete</button>
                </div>
              </div>
            </div>
            <!-- Reaction emojis -->
            <div class="flex items-center mt-4">
              <span class="mr-2">React:</span>
              <!-- Emojis -->
              <button @click="addReaction(post, 'like')" class="text-lg mr-2">👍</button>
              <button @click="addReaction(post, 'love')" class="text-lg mr-2">❤️</button>
              <button @click="addReaction(post, 'laugh')" class="text-lg mr-2">😂</button>
              <button @click="addReaction(post, 'surprised')" class="text-lg mr-2">😮</button>
              <button @click="addReaction(post, 'sad')" class="text-lg mr-2">😢</button>
            </div>
            <!-- Edit button -->
            <div class="mt-4">
              <button @click="showCreatePostModal(post)" class="text-blue-500 focus:outline-none">Edit Post</button>
            </div>
            <!-- Add Comment Section -->
            <div class="mt-4">
              <input v-model="commentInput[post.id]" type="text" placeholder="Add a comment..." class="w-full rounded border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
              <button @click="addComment(post)" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-2">Add Comment</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Sidebar: Actions -->
      <div class="col-span-1 bg-white rounded-lg shadow-md p-6">
        <!-- Title for actions section -->
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Actions</h2>
        <!-- Leave Room button -->
        <button @click="leaveRoom" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4">Leave Room</button>
        <!-- Share Room button -->
        <button @click="shareRoom" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Share Room</button>

        <!-- Button to trigger modal for creating or editing a post -->
        <button @click="showCreatePostModal()" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4">Create New Post</button>
      </div>
    </div>
  </div>

  <!-- Modal for creating or editing a post -->
  <div v-if="showModal" class="fixed inset-0 overflow-y-auto flex justify-center items-center">
    <div class="fixed inset-0 bg-black opacity-50"></div>
    <div class="relative bg-white rounded-lg shadow-lg p-6 w-96">
      <h2 class="text-xl font-semibold mb-4">{{ editingPost ? 'Edit Post' : 'Create New Post' }}</h2>
      <form @submit.prevent="editingPost ? updatePost() : createNewPost()">
        <!-- Post topic -->
        <div class="mb-4">
          <label for="postTopic" class="block text-sm font-medium text-gray-700">Topic</label>
          <input type="text" id="postTopic" v-model="newPost.topic" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
        </div>
        <!-- Post message -->
        <div class="mb-4">
          <label for="postMessage" class="block text-sm font-medium text-gray-700">Message</label>
          <textarea id="postMessage" v-model="newPost.message" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></textarea>
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
import { ref } from 'vue';
import axios from 'axios';
const selectedRoom = ref({
  title: 'Travel Enthusiasts',
  participants: [
    { id: 1, name: 'John Doe', avatar: 'https://via.placeholder.com/50' },
    { id: 2, name: 'Jane Smith', avatar: 'https://via.placeholder.com/50' },
    { id: 3, name: 'Alex Johnson', avatar: 'https://via.placeholder.com/50' }
  ],
  posts: [
    {
      id: 1,
      userId: 1,
      topic: 'Should a woman pay 50/50 if she works the same or more than a man?',
      message: 'What are your thoughts on this topic?',
      timestamp: '10:00 AM',
      liked: false,
      likes: 0,
      showComments: false,
      comments: [
        { id: 1, userId: 2, message: 'I think it depends on the situation.', timestamp: '10:05 AM' },
        { id: 2, userId: 3, message: 'Equality should prevail regardless of gender.', timestamp: '10:10 AM' }
      ]
    },
    {
      id: 2,
      userId: 3,
      topic: 'If our relationship was a movie, what would it be?',
      message: 'Let\'s imagine our relationship as a movie. What genre would it be, and why?',
      timestamp: '10:30 AM',
      liked: false,
      likes: 0,
      showComments: false,
      comments: [
        { id: 3, userId: 2, message: 'Romantic comedy because of all the funny moments we share.', timestamp: '10:35 AM' }
      ]
    }
  ]
});

const showModal = ref(false);
const editedComment = ref('');
const editingCommentId = ref(null);

const newPost = ref({
  topic: '',
  message: ''
});

const editingPost = ref(null);

const commentInput = ref({});

const deletePost = (postId) => {
  const index = selectedRoom.value.posts.findIndex(post => post.id === postId);
  if (index !== -1) {
    selectedRoom.value.posts.splice(index, 1);
  }
};

const deleteComment = (postId, commentId) => {
  const post = selectedRoom.value.posts.find(post => post.id === postId);
  if (post) {
    const commentIndex = post.comments.findIndex(comment => comment.id === commentId);
    if (commentIndex !== -1) {
      post.comments.splice(commentIndex, 1);
    }
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
  if (item.liked) {
    item.likes++;
  } else {
    item.likes--;
  }
};

const toggleCommentSection = (item) => {
  item.showComments = !item.showComments;
};

const addReaction = (post, reaction) => {
  console.log(`Added ${reaction} reaction to post: ${post.topic}`);
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
  newPost.value = {
    topic: '',
    message: ''
  };
  editingPost.value = null;
};

const createNewPost = async () => {
  const newPostData = {
    id: selectedRoom.value.posts.length + 1,
    userId: 1,
    topic: newPost.value.topic,
    message: newPost.value.message,
    timestamp: new Date().toLocaleTimeString(),
    liked: false,
    likes: 0,
    showComments: false,
    comments: []
  };
  selectedRoom.value.posts.push(newPostData);
  closeModal();
  const userName = getParticipantName(newPostData.userId);
  await sendNotification('created a new post.', userName);
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
    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('Notification sent:', response.data);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const updatePost = () => {
  if (editingPost.value) {
    editingPost.value.topic = newPost.value.topic;
    editingPost.value.message = newPost.value.message;
  }
  closeModal();
};

const addComment = async (post) => {
  const userId = 1; // Assuming the user is always the same for simplicity
  const commentId = post.comments.length + 1;
  const comment = {
    id: commentId,
    userId: userId,
    message: commentInput.value[post.id],
    timestamp: new Date().toLocaleTimeString()
  };
  post.comments.push(comment);
  commentInput.value[post.id] = '';
  const userName = getParticipantName(userId);
  await sendNotification('commented on a post.', userName);
};
const editComment = (commentId) => {
  editingCommentId.value = commentId;
  const comment = allComments.find(comment => comment.id === commentId);
  if (comment) {
    editedComment.value = comment.message;
  }
};

const saveEditedComment = (postId, commentId) => {
  const comment = allComments.find(comment => comment.id === commentId);
  if (comment) {
    comment.message = editedComment.value;
    editedComment.value = '';
    editingCommentId.value = null;
  }
};

const cancelEditComment = () => {
  editedComment.value = '';
  editingCommentId.value = null;
};

const getParticipantAvatar = (userId) => {
  const participant = selectedRoom.value.participants.find(participant => participant.id === userId);
  return participant ? participant.avatar : '';
};

const getParticipantName = (userId) => {
  const participant = selectedRoom.value.participants.find(participant => participant.id === userId);
  return participant ? participant.name : '';
};

const getPostComments = (post) => {
  return post.comments;
};

const getPostCommentsCount = (post) => {
  return post.comments.length;
};

// Flatten comments to a single array for easier access
const allComments = selectedRoom.value.posts.reduce((acc, post) => acc.concat(post.comments), []);

</script>
