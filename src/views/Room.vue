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
                <img :src="post.user.avatar" alt="User" class="w-8 h-8 rounded-full mr-2">
                <span class="font-semibold text-gray-800">{{ post.user.name }}</span>
              </div>
              <span class="text-gray-600">{{ post.timestamp }}</span>
            </div>
            <!-- Post topic and message -->
            <h3 class="text-lg font-semibold text-gray-800 mt-2">{{ post.topic }}</h3>
            <p class="text-gray-700">{{ post.message }}</p>
            <!-- Like and Comment Section -->
            <div class="flex justify-between mt-4 items-center">
              <!-- Like button -->
              <div>
                <button @click="toggleLike(post)" class="text-blue-500 focus:outline-none">{{ post.liked ? 'Unlike' : 'Like' }}</button>
                <span class="text-gray-600 ml-2">{{ post.likes }} Likes</span>
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
                    <img :src="comment.user.avatar" alt="User" class="w-6 h-6 rounded-full mr-2">
                    <span class="font-semibold text-gray-800">{{ comment.user.name }}</span>
                  </div>
                  <span class="text-gray-600">{{ comment.timestamp }}</span>
                </div>
                <!-- Comment message -->
                <p class="text-gray-700">{{ comment.message }}</p>
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
          </div>

          <!-- Poll Section -->
          <div v-if="post.poll" class="bg-gray-100 rounded-lg p-4 mb-4">
            <!-- Poll question -->
            <h4 class="text-lg font-semibold text-gray-800 mb-2">Poll: {{ post.poll.question }}</h4>
            <ul>
              <!-- Loop through poll options -->
              <li v-for="(option, index) in post.poll.options" :key="index" class="mb-2">
                <!-- Card-like design for each option -->
                <div class="bg-white rounded-lg shadow-md p-4 flex items-center justify-between">
                  <label class="flex items-center cursor-pointer">
                    <!-- Radio buttons for poll options -->
                    <input type="radio" :name="'poll_' + post.id" :value="option" @change="voteInPoll(post, index)">
                    <span class="ml-2">{{ option }}</span>
                  </label>
                </div>
              </li>
            </ul>
            <!-- Like and Comment Section for Poll -->
            <div class="flex justify-between mt-4 items-center">
              <!-- Like button for poll -->
              <div>
                <button @click="toggleLike(post.poll)" class="text-blue-500 focus:outline-none">{{ post.poll.liked ? 'Unlike' : 'Like' }}</button>
                <span class="text-gray-600 ml-2">{{ post.poll.likes }} Likes</span>
              </div>
              <!-- Comment button for poll -->
              <div>
                <button @click="toggleCommentSection(post.poll)" class="text-blue-500 focus:outline-none">{{ post.poll.showComments ? 'Hide Comments' : 'Show Comments' }}</button>
                <span class="text-gray-600 ml-2">{{ post.poll.comments.length }} Comments</span>
              </div>
            </div>
            <!-- Comments Section for Poll -->
            <div v-if="post.poll.showComments" class="mt-4">
              <div v-for="comment in post.poll.comments" :key="comment.id" class="bg-gray-200 rounded-lg p-2 mb-2">
                <!-- Comment author and timestamp -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <img :src="comment.user.avatar" alt="User" class="w-6 h-6 rounded-full mr-2">
                    <span class="font-semibold text-gray-800">{{ comment.user.name }}</span>
                  </div>
                  <span class="text-gray-600">{{ comment.timestamp }}</span>
                </div>
                <!-- Comment message -->
                <p class="text-gray-700">{{ comment.message }}</p>
              </div>
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

        <!-- Button to trigger modal for creating a new post -->
        <button @click="showCreatePostModal" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4">Create New Post</button>
      </div>
    </div>
  </div>

  <!-- Modal for creating a new post -->
  <div v-if="showModal" class="fixed inset-0 overflow-y-auto flex justify-center items-center">
    <div class="fixed inset-0 bg-black opacity-50"></div>
    <div class="relative bg-white rounded-lg shadow-lg p-6 w-96">
      <h2 class="text-xl font-semibold mb-4">Create New Post</h2>
      <form @submit.prevent="createNewPost">
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
          <button type="submit" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Create</button>
          <button @click="closeModal" type="button" class="ml-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      selectedRoom: {
        title: 'Travel Enthusiasts',
        participants: [
          { id: 1, name: 'John Doe', avatar: 'https://via.placeholder.com/50' },
          { id: 2, name: 'Jane Smith', avatar: 'https://via.placeholder.com/50' },
          { id: 3, name: 'Alex Johnson', avatar: 'https://via.placeholder.com/50' }
        ],
        posts: [
          {
            id: 1,
            user: { name: 'John Doe', avatar: 'https://via.placeholder.com/50' },
            topic: 'Should a woman pay 50/50 if she works the same or more than a man?',
            message: 'What are your thoughts on this topic?',
            timestamp: '10:00 AM',
            liked: false,
            likes: 0,
            showComments: false,
            comments: [
              { id: 1, user: { name: 'Jane Smith', avatar: 'https://via.placeholder.com/50' }, message: 'I think it depends on various factors such as the financial situation of each person and the dynamics of their relationship.', timestamp: '10:15 AM' },
              { id: 2, user: { name: 'Alex Johnson', avatar: 'https://via.placeholder.com/50' }, message: 'Agreed, it should be based on individual circumstances rather than gender norms.', timestamp: '10:30 AM' }
            ],
            poll: null
          },
          {
            id: 2,
            user: { name: 'Alex Johnson', avatar: 'https://via.placeholder.com/50' },
            topic: 'If our relationship was a movie, what would it be?',
            message: 'Let\'s imagine our relationship as a movie. What genre would it be, and why?',
            timestamp: '10:30 AM',
            liked: false,
            likes: 0,
            showComments: false,
            comments: [
              { id: 3, user: { name: 'John Doe', avatar: 'https://via.placeholder.com/50' }, message: 'I think our relationship would be a Romantic Comedy because we always find humor in everything.', timestamp: '11:00 AM' }
            ],
            poll: {
              question: 'What genre would our relationship movie be?',
              options: ['Romantic Comedy', 'Action', 'Drama', 'Thriller'],
              liked: false,
              likes: 0,
              showComments: false,
              comments: []
            }
          }
        ]
      },
      showModal: false,
      newPost: {
        topic: '',
        message: ''
      }
    };
  },
  methods: {
    leaveRoom() {
      console.log('Left the room');
    },
    shareRoom() {
      console.log('Shared the room');
    },
    toggleLike(item) {
      item.liked = !item.liked;
      if (item.liked) {
        item.likes++;
      } else {
        item.likes--;
      }
    },
    toggleCommentSection(item) {
      item.showComments = !item.showComments;
    },
    voteInPoll(post, optionIndex) {
      if (!post.poll.voted) {
        post.poll.voted = true;
        post.poll.votes[optionIndex]++;
      }
    },
    addReaction(post, reaction) {
      console.log(`Added ${reaction} reaction to post: ${post.topic}`);
    },
    showCreatePostModal() {
      this.showModal = true;
    },
    closeModal() {
      this.showModal = false;
      // Reset new post data
      this.newPost = {
        topic: '',
        message: ''
      };
    },
    createNewPost() {
      // For demonstration, pushing the new post directly to selectedRoom.posts
      const newPost = {
        id: this.selectedRoom.posts.length + 1,
        user: { name: 'John Doe', avatar: 'https://via.placeholder.com/50' },
        topic: this.newPost.topic,
        message: this.newPost.message,
        timestamp: new Date().toLocaleTimeString(),
        liked: false,
        likes: 0,
        showComments: false,
        comments: [],
        poll: null
      };
      this.selectedRoom.posts.push(newPost);
      // Close modal and reset new post data
      this.closeModal();
    }
  }
};
</script>

<style scoped>
/* Styles for the modal */
</style>
