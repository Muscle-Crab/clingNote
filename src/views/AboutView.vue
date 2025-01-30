<template>
  <div class="p-4 sm:p-6 bg-gray-100 min-h-screen">
    <h2 class="text-2xl font-bold mb-4 text-gray-800 text-center">User Dashboard</h2>

    <div class="mb-4 text-gray-700 text-center">
      <strong>Total Users: {{ users.length }}</strong>
    </div>

    <div v-if="loading" class="text-center text-gray-500">Loading users...</div>
    <div v-else-if="errorMessage" class="text-red-500 bg-red-100 border border-red-400 px-4 py-2 rounded mb-4 text-center">
      {{ errorMessage }}
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full bg-white shadow-md rounded-lg overflow-hidden text-sm sm:text-base">
        <thead class="bg-indigo-600 text-white">
        <tr>
          <th class="py-2 px-4 text-left">Name</th>
          <th class="py-2 px-4 text-left hidden sm:table-cell">Email</th>
          <th class="py-2 px-4 text-left">Gender</th>
          <th class="py-2 px-4 text-left">Actions</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="user in users" :key="user.id" class="border-b">
          <td class="py-2 px-4">{{ user.name }}</td>
          <td class="py-2 px-4 hidden sm:table-cell">{{ user.email }}</td>
          <td class="py-2 px-4 capitalize">{{ user.gender }}</td>
          <td class="py-2 px-4">
            <button
                @click="confirmDelete(user.id, user.email)"
                class="text-red-500 hover:text-red-700 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M6 8a1 1 0 011-1h6a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1V8zm3-3a1 1 0 012 0v1h2.5a.5.5 0 110 1H5.5a.5.5 0 010-1H9V5z" clip-rule="evenodd"/>
              </svg>
            </button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import {collection, getDocs, deleteDoc, doc} from 'firebase/firestore';
import {getAuth, deleteUser} from 'firebase/auth';
import {db} from '@/firebaseConfig';

const users = ref([]);
const loading = ref(true);
const errorMessage = ref('');

const fetchUsers = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    users.value = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  } catch (error) {
    console.error('Error fetching users:', error);
    errorMessage.value = 'Failed to fetch users. Please try again later.';
  } finally {
    loading.value = false;
  }
};

const confirmDelete = async (userId, userEmail) => {
  const confirmDelete = confirm(`Are you sure you want to delete the account associated with ${userEmail}? This action is irreversible.`);
  if (confirmDelete) {
    await deleteUserAccount(userId);
  }
};

const deleteUserAccount = async (userId) => {
  try {
    // Delete from Firestore
    await deleteDoc(doc(db, 'users', userId));

    // Delete from Firebase Authentication
    const auth = getAuth();
    const userToDelete = auth.currentUser; // Firebase requires authenticated user context
    if (userToDelete && userToDelete.uid === userId) {
      await deleteUser(userToDelete);
    }

    // Update UI
    users.value = users.value.filter(user => user.id !== userId);
    console.log('User deleted successfully from Firestore & Auth');
  } catch (error) {
    console.error('Error deleting user:', error);
    errorMessage.value = 'Failed to delete user. Please try again.';
  }
};

onMounted(fetchUsers);
</script>
