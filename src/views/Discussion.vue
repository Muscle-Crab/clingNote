<template>
  <div class="bg-gray-100">
    <div class="container mx-auto px-4 py-8 ">
      <h1 class="text-3xl font-bold  mb-12">Explore Rooms</h1>
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div v-for="room in rooms" :key="room.roomId" class="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition duration-500">
          <div class="p-8 bg-white">
            <h5 class="text-xl font-bold text-black">{{ room.title }}</h5>
            <p class="text-gray-700">{{ room.description }}</p>
            <button class="block w-full mt-4 bg-gradient-to-r from-green-400 to-blue-500 hover:bg-gradient-to-l text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="joinRoom(room.roomId)">
              Join Room
            </button>
            <template v-if="isCreator(room.user_id)">
              <button class="block w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="editRoom(room)">
                Edit Room
              </button>
              <button class="block w-full mt-4 bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" @click="deleteRoom(room.roomId)">
                Delete Room
              </button>
            </template>
          </div>
        </div>
      </div>
      <button @click="openModal" class="block w-full mt-8 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Create New Room</button>
      <div id="authentication-modal" tabindex="-1" aria-hidden="true" class="hidden overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full">
        <div class="relative p-4 w-full max-w-md max-h-full">
          <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
            <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white" v-if="!editedRoom.id">
                Create New Room
              </h3>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white" v-else>
                Edit Room
              </h3>
              <button @click="closeModal" type="button" class="end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white">
                <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                </svg>
                <span class="sr-only">Close modal</span>
              </button>
            </div>
            <div class="p-4 md:p-5">
              <form v-if="!editedRoom.id" @submit.prevent="createNewRoom" class="space-y-4" action="#">
                <div class="mb-4">
                  <label for="newRoomTitle" class="block text-sm font-medium text-gray-700">Title</label>
                  <input type="text" id="newRoomTitle" v-model="newRoom.title" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <div class="mb-4">
                  <label for="newRoomDescription" class="block text-sm font-medium text-gray-700">Description</label>
                  <textarea id="newRoomDescription" v-model="newRoom.description" rows="3" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                </div>
                <button type="submit" class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Create Room</button>
              </form>
              <form v-else @submit.prevent="updateRoom" class="space-y-4" action="#">
                <div class="mb-4">
                  <label for="editedRoomTitle" class="block text-sm font-medium text-gray-700">Title</label>
                  <input type="text" id="editedRoomTitle" v-model="editedRoom.title" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <div class="mb-4">
                  <label for="editedRoomDescription" class="block text-sm font-medium text-gray-700">Description</label>
                  <textarea id="editedRoomDescription" v-model="editedRoom.description" rows="3" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                </div>
                <button type="submit" class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Update Room</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { db, auth } from '@/firebaseConfig.js';
import { ref, reactive, onMounted } from 'vue';
import { addDoc, getDocs, collection, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';

const router = useRouter();

const rooms = ref([]);
const newRoom = reactive({
  title: '',
  description: ''
});
const editedRoom = reactive({
  id: '',
  title: '',
  description: ''
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
    rooms.value = querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error loading rooms:', error);
  }
};

const joinRoom = (roomId) => {
  router.push(`/room/${roomId}`);
};

const createNewRoom = async () => {
  try {
    const { title, description } = newRoom;
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
      timestamp: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'rooms'), newRoomData);
    const roomId = docRef.id;
    console.log('New room added successfully with ID:', roomId);
    await updateDoc(doc(db, 'rooms', docRef.id), { roomId });
    newRoom.title = '';
    newRoom.description = '';
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
  openModal();
};

const updateRoom = async () => {
  try {
    const { id, title, description } = editedRoom;
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
      description
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
const isCreator = (userId) => {
  const currentUser = auth.currentUser;
  return currentUser && currentUser.uid === userId;
};

onMounted(loadRooms);
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
