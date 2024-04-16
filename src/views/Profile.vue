<template>
  <div class="container mx-auto py-8">
    <div v-if="userData" class="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
      <!-- Profile Image -->
      <div class="relative">
        <img class="h-32 w-full object-cover" src="https://cdn.pixabay.com/photo/2023/11/14/11/07/sparrow-8387465_640.jpg" alt="Profile Picture">
        <div class="absolute inset-0 bg-black opacity-50"></div>
        <div class="absolute inset-x-0 bottom-0 pb-2 text-center">
          <img class="h-16 w-16 object-cover rounded-full border-4 border-white shadow-md" src="https://cdn.pixabay.com/photo/2023/08/24/01/01/boy-8209561_640.jpg" alt="Profile Picture">
        </div>
      </div>

      <!-- Profile Information -->
      <div v-if="!editMode" class="p-4">
        <h1 class="text-2xl font-semibold text-gray-800">{{ userData.name }}</h1>
        <p class="text-sm font-medium text-gray-600 mt-1">{{ userData.email }}</p>
        <p class="text-sm font-medium text-gray-600">{{ userData.gender }}</p>
        <p class="text-sm font-medium text-gray-600">{{ formatDOB(userData.dob) }}</p>
        <button @click="editMode = true" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Edit
        </button>
      </div>

      <!-- Edit Profile Information -->
      <div v-else class="p-4">
        <input type="text" v-model="editedUserData.name" class="border border-gray-300 rounded-md p-1 mb-2 w-full" placeholder="Name">
        <input type="email" v-model="editedUserData.email" class="border border-gray-300 rounded-md p-1 mb-2 w-full" placeholder="Email">
        <select v-model="editedUserData.gender" class="border border-gray-300 rounded-md p-1 mb-2 w-full">
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <input type="date" v-model="editedUserData.dob" class="border border-gray-300 rounded-md p-1 mb-2 w-full">
        <button @click="saveUserData" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Save
        </button>
        <button @click="editMode = false" class="ml-2 bg-gray-400 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
          Cancel
        </button>
      </div>
    </div>
    <div v-else class="text-center text-gray-500">
      Loading...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { auth, db } from '@/firebaseConfig';
const route = useRouter();

const userData = ref(null);
const editedUserData = ref(null);
const editMode = ref(false);

// Fetch user data from Firestore
const fetchUserData = async () => {
  try {
    const docRef = doc(db, 'users', route.currentRoute.value.params.userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      userData.value = docSnap.data();
      // Prepopulate editedUserData with userData when entering edit mode
      editedUserData.value = { ...userData.value };
    } else {
      console.error('User document does not exist');
    }
  } catch (error) {
    console.error('Error fetching user data:', error.message);
  }
};

onMounted(() => {
  fetchUserData();
});

// Method to format date of birth
const formatDOB = (dob) => {
  const date = new Date(dob);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Method to save edited user data
const saveUserData = async () => {
  try {
    const docRef = doc(db, 'users', route.currentRoute.value.params.userId);
    await updateDoc(docRef, editedUserData.value);
    userData.value = { ...editedUserData.value };
    editMode.value = false;
  } catch (error) {
    console.error('Error saving user data:', error.message);
  }
};
</script>
