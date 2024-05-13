<template>
  <!-- Container for the entire room -->
  <div class="container mx-auto px-4 py-8">
    <!-- Room title -->
<!--    <h1 class="text-3xl font-bold text-gray-800 mb-8 md:mb-12">Room: {{ selectedRoom.title }}</h1>-->

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
      <div class="col-span-2 grid grid-cols-1 gap-8">
        <!-- Title for posts section -->

        <!-- Loop through each post -->
        <div v-for="post in selectedRoom.posts" :key="post.id" class="md:min-w-[320px] mb-4">
          <!-- Post -->
          <div class="min-w-sm p-6 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
            <!-- Post author and timestamp -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center">
                <img :src="getParticipantAvatar(post.userId)" alt="User" class="w-8 h-8 rounded-full mr-2">
                <span class="font-semibold text-gray-800">{{ getParticipantName(post.userId) }}</span>
              </div>
<!--              <span class="text-gray-600">{{ formatTimestampToAgo(post.timestamp) }}</span>-->
            </div>
            <!-- Post topic and message -->
            <a href="#">
              <h5 class="mb-2  font-bold tracking-tight text-gray-900 dark:text-white">{{post.topic}}</h5>
            </a>
            <p class="text-gray-700 mb-4">{{ post.message }}</p>

            <!-- Like and Comment Section -->
            <!-- Like and Comment Section -->
            <div class="flex justify-between items-center ">
              <!-- Like button -->
              <div>
                <button @click="toggleLike(post)" class="flex items-center text-blue-500 focus:outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                  <span>{{ post.likes }}</span>
                </button>
              </div>
              <!-- Comment button -->
              <div>
                <button @click="toggleCommentSection(post)" class="flex items-center text-blue-500 focus:outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                  <span>{{ post.comments.length }}</span>
                </button>
              </div>
            </div>

            <!-- Comments Section -->
            <!-- Comments Section -->
            <section v-if="post.showComments" class="bg-white dark:bg-gray-900 antialiased">
              <div class="">
                <!-- Loop through comments -->
                <article v-for="comment in post.comments" :key="comment.id" class="pt-4 md:p-4  text-base bg-white ">
                  <footer class="flex flex-col md:flex-row justify-between   ">
                    <div class="flex   ">
                      <img class="w-8 h-8  md:w-12 md:h-12 rounded-full mr-3" :src="getParticipantAvatar(comment.userId)" :alt="getParticipantName(comment.userId)">
                      <div>
                        <p class="text-sm text-gray-900 dark:text-white font-semibold">{{ getParticipantName(comment.userId) }}</p>
                        <!-- Editable comment input -->
                        <textarea v-if="editingCommentId === comment.id" v-model="editedComment" class="mt-1 block w-full text-sm text-gray-900 border-0 focus:ring-0 focus:outline-none dark:text-white dark:placeholder-gray-400 dark:bg-gray-800" required>{{ comment.message }}</textarea>
                        <!-- Display the comment text if not in edit mode -->
                        <p v-else class="text-gray-500 dark:text-gray-400">{{ comment.message }}</p>
                      </div>
                    </div>
                    <div>
                      <!-- Edit and Save Buttons -->
                      <button v-if="editingCommentId !== comment.id && currentUser && currentUser.uid === comment.userId" @click="editComment(comment)" class="text-blue-500 focus:outline-none">Edit</button> |
                      <button v-if="editingCommentId !== comment.id && currentUser && currentUser.uid === comment.userId" @click="deleteComment(post, comment.id)" class="text-red-500 focus:outline-none">Delete</button>
                      <button v-if="editingCommentId === comment.id" @click="saveComment(post, comment)" class="text-green-500 focus:outline-none">Save</button>
                    </div>
                  </footer>
                </article>
              </div>
            </section>



            <!-- Inside the loop for each post -->
            <div class="flex items-center mb-4 mt-5 space-x-4">


              <!-- Like reaction -->
              <button @click="toggleReaction(post, 'like')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'like') }">
                <span class="reaction-icon">👍</span>
                <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'like') }}</span>
              </button>

              <!-- Love reaction -->
              <button @click="toggleReaction(post, 'love')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'love') }">
                <span class="reaction-icon">❤️</span>
                <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'love') }}</span>
              </button>

              <!-- Laugh reaction -->
              <button @click="toggleReaction(post, 'laugh')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'laugh') }">
                <span class="reaction-icon">😂</span>
                <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-yellow-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'laugh') }}</span>
              </button>

              <!-- Surprised reaction -->
              <button @click="toggleReaction(post, 'surprised')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'surprised') }">
                <span class="reaction-icon">😮</span>
                <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-green-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'surprised') }}</span>
              </button>

              <!-- Sad reaction -->
              <button @click="toggleReaction(post, 'sad')" class="reaction-button relative" :class="{ 'active': hasReaction(post, 'sad') }">
                <span class="reaction-icon">😢</span>
                <span class="reaction-count absolute top-0 right-0 -mt-1 -mr-2 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{{ getReactionCount(post, 'sad') }}</span>
              </button>
            </div>




            <!-- Edit button -->
            <div class="mb-4">
              <button @click="showCreatePostModal(post)" class="text-blue-500 focus:outline-none">Edit Post</button>
            </div>

            <!-- Add Comment Section -->
            <div class="flex items-center border-t border-gray-200 py-2">
              <input v-model="commentInput[post.id]" type="text" placeholder="Add a comment..." class="flex-1 rounded-full py-2 px-4 mr-2 border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500">
              <button @click="addComment(post)" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"><i class="fa fa-comment"></i></button>
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
        <button @click="shareRoom" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4">Share Room</button>
        <!-- Button to trigger modal for creating or editing a post -->
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
        <!-- Post topic -->
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
import { ref,onMounted } from 'vue';
import axios from 'axios';
import { db, auth} from '@/firebaseConfig';
import { formatDistanceToNow } from 'date-fns';
import { collection, getDoc, onSnapshot, getDocs, addDoc,serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useRoute } from 'vue-router';
const generateUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};

const route = useRoute();
const room_id = ref(route.params.id);
const selectedRoom = ref({
  title: 'Travel Enthusiasts',
  participants: [],
  posts: []
});
onMounted(async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    querySnapshot.forEach(doc => {
      // Push each user document to the participants array
      selectedRoom.value.participants.push(doc.data());
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
  }
});
const showModal = ref(false);
const editedComment = ref('');
const editingCommentId = ref(null);
// Function to format Firestore Timestamp to JavaScript Date
const formatTimestampToAgo = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp.toDate();
  const timeAgo = formatDistanceToNow(date, { addSuffix: true, includeSeconds: true });
  return timeAgo.replace('about ', '');
};
const newPost = ref({
  topic: '',
  message: ''
});

const editingPost = ref(null);

const commentInput = ref({});

const deletePost = async (postId) => {
  try {
    await deleteDoc(doc(db, 'posts', postId));
    const index = selectedRoom.value.posts.findIndex(post => post.id === postId);
    if (index !== -1) {
      selectedRoom.value.posts.splice(index, 1);
    }
  } catch (error) {
    console.error('Error deleting post from Firestore: ', error);
  }
};
onMounted(() => {
  // Listen for changes to the 'posts' collection in Firestore
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

  // Unsubscribe from the snapshot listener when the component is unmounted
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
  if (item.liked) {
    item.likes++;
  } else {
    item.likes--;
  }
};
// Add/Edit Comment Functions
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

    // Toggle the reaction for the current user
    if (postReactions[currentUser.value.uid] === reaction) {
      delete postReactions[currentUser.value.uid]; // Remove reaction
    } else {
      postReactions[currentUser.value.uid] = reaction; // Add reaction
    }

    // Update the reactions in the database
    await updateDoc(postRef, { reactions: postReactions });

    // Optionally, update the local post object with the updated reactions
    post.reactions = postReactions;
  } catch (error) {
    console.error('Error toggling reaction: ', error);
  }
};

const hasReaction = (post, reaction) => {
  // const postReactions = post.reactions || {};
  // if(currentUser.value.uid){
  //   return postReactions[currentUser.value.uid] === reaction;
  // }

};

const getReactionCount = (post, reaction) => {
  const postReactions = post.reactions || {};
  const reactionCount = Object.values(postReactions).filter(r => r === reaction).length;
  return reactionCount;
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
const currentUser = ref(null);

// Listen for changes to the user authentication state
onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in.
      console.log(user)
      currentUser.value = user;
    } else {
      // No user is signed in.
      currentUser.value = null;
    }
  });
});


// Function to create a new post
const createNewPost = async () => {
  const userId = currentUser.value ? currentUser.value.uid : null;
  console.log(room_id.value)
  if (!userId) {
    // User is not signed in
    console.error('User is not signed in');
    return;
  }
  const newPostData = {

    userId: userId, // Assuming the user ID is hardcoded for simplicity
    room_id:room_id.value,
    topic: newPost.value.topic,
    message: newPost.value.message,
    timestamp: serverTimestamp(),
    liked: false,
    likes: 0,
    showComments: false,
    comments: []
  };

  try {
    // Add the new post data to the "posts" collection in Firestore
    const docRef = await addDoc(collection(db, 'posts'), newPostData);

    // Close the modal and clear the new post form fields
    closeModal();

    // Notify the user about the new post
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
    userId: userId,
    message: commentInput.value[post.id],
    timestamp: new Date().toLocaleTimeString(),
    id: generateUniqueId() // Function to generate a unique ID
  };

  try {
    await updateDoc(doc(db, 'posts', post.id), {
      comments: arrayUnion(comment)
    });
    console.log('Comment added successfully!');
    commentInput.value[post.id] = '';
    const userName = getParticipantName(userId);
    await sendNotification('commented on a post.', userName);
  } catch (e) {
    console.error('Error adding comment: ', e);
  }
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
