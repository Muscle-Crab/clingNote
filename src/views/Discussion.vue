<template>
  <div class="min-h-screen bg-gray-900 dark:bg-[#1c1c1e]">
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold mb-12 text-white">Explore Rooms</h1>

      <!-- Skeleton Loader -->
      <div v-if="loading" role="status" class="space-y-8 animate-pulse md:space-y-0 md:space-x-8 rtl:space-x-reverse md:flex md:items-center">
        <div class="flex items-center justify-center w-full h-48 bg-gray-700 rounded sm:w-96">
          <svg class="w-10 h-10 text-gray-600" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18">
            <path d="M18 0H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm-5.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm4.376 10.481A1 1 0 0 1 16 15H4a1 1 0 0 1-.895-1.447l3.5-7A1 1 0 0 1 7.468 6a.965.965 0 0 1 .9.5l2.775 4.757 1.546-1.887a1 1 0 0 1 1.618.1l2.541 4a1 1 0 0 1 .028 1.011Z"/>
          </svg>
        </div>
        <div class="w-full">
          <div class="h-2.5 bg-gray-700 rounded-full w-48 mb-4"></div>
          <div class="h-2 bg-gray-700 rounded-full max-w-[480px] mb-2.5"></div>
          <div class="h-2 bg-gray-700 rounded-full mb-2.5"></div>
          <div class="h-2 bg-gray-700 rounded-full max-w-[440px] mb-2.5"></div>
          <div class="h-2 bg-gray-700 rounded-full max-w-[460px] mb-2.5"></div>
          <div class="h-2 bg-gray-700 rounded-full max-w-[360px]"></div>
        </div>
        <span class="sr-only">Loading...</span>
      </div>

      <!-- Actual Content -->
      <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div v-for="room in rooms" :key="room.roomId" class="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition duration-500">
          <div class="relative bg-gray-800 border-4 border-indigo-500 p-6 rounded-2xl">
            <div class="absolute top-0 left-0 w-full h-full rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 opacity-20 pointer-events-none"></div>
            <div class="relative z-10">
              <h5 class="text-xl font-bold text-white">{{ room.title }}</h5>
              <p class="text-gray-400">{{ room.description }}</p>
              <button v-if="!room.private || isApproved(room) || isCreator(room.user_id)" class="block w-full mt-4 bg-gradient-to-r from-green-400 to-blue-500 hover:bg-gradient-to-l text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="joinRoom(room.roomId)">
                Join Room
              </button>
              <button v-else-if="hasRequestedAccess(room)" class="block w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" disabled>
                Requested
              </button>
              <button v-else class="block w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="requestAccess(room.roomId)">
                Request Access
              </button>
              <template v-if="isCreator(room.user_id)">
                <button class="block w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="editRoom(room)">
                  Edit Room
                </button>
                <button class="block w-full mt-4 bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="deleteRoom(room.roomId)">
                  Delete Room
                </button>
                <div v-if="room.requests && room.requests.length > 0" class="mt-4">
                  <h5 class="text-xl font-bold text-white">Join Requests</h5>
                  <ul>
                    <li v-for="request in room.requests" :key="request.uid" class="text-white">
                      {{ request.name }}
                      <button @click="approveRequest(room.roomId, request.uid)" class="ml-2 bg-green-400 hover:bg-green-500 text-white font-bold py-1 px-2 rounded">Approve</button>
                      <button @click="rejectRequest(room.roomId, request.uid)" class="ml-2 bg-red-400 hover:bg-red-500 text-white font-bold py-1 px-2 rounded">Reject</button>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <button @click="openModal" class="fixed bottom-16 right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
      </button>


      <div id="authentication-modal" tabindex="-1" aria-hidden="true" class="hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full">
        <div class="relative p-4 w-full max-w-md max-h-full">
          <div class="relative bg-gray-700 rounded-lg shadow">
            <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
              <h3 class="text-xl font-semibold text-white" v-if="!editedRoom.id">
                Create New Room
              </h3>
              <h3 class="text-xl font-semibold text-white" v-else>
                Edit Room
              </h3>
              <button @click="closeModal" type="button" class="text-gray-400 bg-transparent hover:bg-gray-600 hover:text-white rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center">
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 1l6 6m0 0l6 6M7 7l6-6M7 7l-6 6"/>
                </svg>
                <span class="sr-only">Close modal</span>
              </button>
            </div>
            <div class="p-4 md:p-5">
              <form v-if="!editedRoom.id" @submit.prevent="createNewRoom" class="space-y-4">
                <div class="mb-4">
                  <label for="newRoomTitle" class="block text-sm font-medium text-gray-300">Title</label>
                  <input type="text" id="newRoomTitle" v-model="newRoom.title" class="mt-1 block w-full border-gray-500 bg-gray-600 text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <div class="mb-4">
                  <label for="newRoomDescription" class="block text-sm font-medium text-gray-300">Description</label>
                  <textarea id="newRoomDescription" v-model="newRoom.description" rows="3" class="mt-1 block w-full border-gray-500 bg-gray-600 text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                </div>
                <div class="mb-4">
                  <label for="roomPrivate" class="block text-sm font-medium text-gray-300">Private Room</label>
                  <input type="checkbox" id="roomPrivate" v-model="newRoom.private" class="mt-1">
                </div>
                <button type="submit" class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Create Room</button>
              </form>
              <form v-else @submit.prevent="updateRoom" class="space-y-4">
                <div class="mb-4">
                  <label for="editedRoomTitle" class="block text-sm font-medium text-gray-300">Title</label>
                  <input type="text" id="editedRoomTitle" v-model="editedRoom.title" class="mt-1 block w-full border-gray-500 bg-gray-600 text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <div class="mb-4">
                  <label for="editedRoomDescription" class="block text-sm font-medium text-gray-300">Description</label>
                  <textarea id="editedRoomDescription" v-model="editedRoom.description" rows="3" class="mt-1 block w-full border-gray-500 bg-gray-600 text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                </div>
                <div class="mb-4">
                  <label for="roomPrivateEdit" class="block text-sm font-medium text-gray-300">Private Room</label>
                  <input type="checkbox" id="roomPrivateEdit" v-model="editedRoom.private" class="mt-1">
                </div>
                <button type="submit" class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Update Room</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {db, auth} from '@/firebaseConfig.js';
import {ref, reactive, onMounted} from 'vue';
import {
  addDoc,
  getDocs,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import {useRouter} from 'vue-router';
import axios from 'axios';

const router = useRouter();

const rooms = ref([]);
const loading = ref(true);
const newRoom = reactive({
  title: '',
  description: '',
  private: false
});
const editedRoom = reactive({
  id: '',
  title: '',
  description: '',
  private: false
});

const openModal = () => {
  const modal = document.getElementById('authentication-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
};

const closeModal = () => {
  const modal = document.getElementById('authentication-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
};

const loadRooms = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'rooms'));
    rooms.value = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    loading.value = false;
  } catch (error) {
    console.error('Error loading rooms:', error);
    loading.value = false;
  }
};

const joinRoom = (roomId) => {
  router.push(`/room/${roomId}`);
};

const createNewRoom = async () => {
  try {
    const {title, description, private: isPrivate} = newRoom;
    if (!title || !description) {
      console.error('Title and description are required');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No user is currently signed in');
      return;
    }
    const userId = currentUser.uid;

    const newRoomData = {
      title,
      description,
      user_id: userId,
      private: isPrivate,
      requests: [],
      approvedUsers: [userId], // Add the creator's user ID to the approvedUsers array
      timestamp: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'rooms'), newRoomData);
    const roomId = docRef.id;
    console.log('New room added successfully with ID:', roomId);
    await updateDoc(doc(db, 'rooms', docRef.id), {roomId});
    newRoom.title = '';
    newRoom.description = '';
    newRoom.private = false;
    await loadRooms();
    closeModal(); // Close modal after creating the room
  } catch (error) {
    console.error('Error creating new room:', error);
  }
};


const editRoom = (room) => {
  editedRoom.id = room.roomId;
  editedRoom.title = room.title;
  editedRoom.description = room.description;
  editedRoom.private = room.private;
  openModal();
};

const updateRoom = async () => {
  try {
    const {id, title, description, private: isPrivate} = editedRoom;
    if (!title || !description) {
      console.error('Title and description are required');
      return;
    }

    const currentUser = auth.currentUser;
    const roomRef = doc(db, 'rooms', id);
    const roomSnapshot = await getDoc(roomRef);
    const roomData = roomSnapshot.data();
    if (!currentUser || roomData.user_id !== currentUser.uid) {
      console.error('You are not authorized to update this room');
      return;
    }

    await updateDoc(roomRef, {
      title,
      description,
      private: isPrivate
    });

    console.log('Room updated successfully');
    await loadRooms();
    closeModal(); // Close modal after updating the room
  } catch (error) {
    console.error('Error updating room:', error);
  }
};

const deleteRoom = async (roomId) => {
  try {
    const currentUser = auth.currentUser;
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);
    const roomData = roomSnapshot.data();
    if (!currentUser || roomData.user_id !== currentUser.uid) {
      console.error('You are not authorized to delete this room');
      return;
    }
    await deleteDoc(roomRef);
    console.log('Room deleted successfully');
    await loadRooms();
  } catch (error) {
    console.error('Error deleting room:', error);
  }
};

const requestAccess = async (roomId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No user is currently signed in');
      return;
    }

    const userName = currentUser.displayName || currentUser.email;
    const requestData = {
      uid: currentUser.uid,
      name: userName
    };

    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      requests: arrayUnion(requestData)
    });
    console.log('Request access successful');
    await loadRooms(); // Refresh the room data to update the UI

    // Send notification to the room creator
    const roomData = (await getDoc(roomRef)).data();
    sendNotification('has requested to join your room.', roomData.user_id);
  } catch (error) {
    console.error('Error requesting access:', error);
  }
};

const approveRequest = async (roomId, userId) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);
    const roomData = roomSnapshot.data();
    const updatedRequests = roomData.requests.filter(request => request.uid !== userId);

    await updateDoc(roomRef, {
      requests: updatedRequests,
      approvedUsers: arrayUnion(userId)
    });
    console.log('Request approved');
    await loadRooms(); // Refresh the room data to update the UI

    // Send notification to the approved user
    const user = (await getDoc(doc(db, 'users', userId))).data();
    sendNotification('your request to join the room has been approved.', user.email);
  } catch (error) {
    console.error('Error approving request:', error);
  }
};

const rejectRequest = async (roomId, userId) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);
    const roomData = roomSnapshot.data();
    const updatedRequests = roomData.requests.filter(request => request.uid !== userId);

    await updateDoc(roomRef, {
      requests: updatedRequests
    });
    console.log('Request rejected');
    await loadRooms(); // Refresh the room data to update the UI
  } catch (error) {
    console.error('Error rejecting request:', error);
  }
};

const hasRequestedAccess = (room) => {
  const currentUser = auth.currentUser;
  return room.requests.some(request => request.uid === currentUser.uid);
};

const isCreator = (userId) => {
  const currentUser = auth.currentUser;
  return currentUser && currentUser.uid === userId;
};

const isApproved = (room) => {
  const currentUser = auth.currentUser;
  return room.approvedUsers.includes(currentUser.uid);
};

const sendNotification = async (message, userId) => {
  const headers = {
    'Authorization': 'Bearer token="ZWY3MWJhMDUtNTU1Yi00NGViLThmNjItNDNhZTY0YzMwOGRh"',
    'Content-Type': 'application/json'
  };
  const userName = auth.currentUser.displayName || auth.currentUser.email;
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

onMounted(loadRooms);
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
