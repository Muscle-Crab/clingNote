<template>
  <div class="p-4 sm:p-6 md:p-8 min-h-screen flex flex-col items-center" style="background: #E3E6E6">
    <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-green-700 mb-6 md:mb-10">Soccer Pickup Group</h1>
    <div class="flex justify-between items-center mb-6">
      <button
          class="bg-red-500 text-white py-2 px-4 rounded-full hover:bg-red-600 transition text-base font-medium"
          @click="resetGame"
      >
        New  Game
      </button>
    </div>
    <p class="text-lg md:text-xl font-bold text-gray-800 mb-4">Today's Date: {{ today }}</p>

    <!-- Captain Selection Section -->
    <div v-if="playersGoing >= 2" class="w-full max-w-xl md:max-w-3xl bg-white p-4 sm:p-6 rounded-xl md:rounded-2xl shadow-lg">
      <h2 class="text-2xl md:text-3xl font-semibold text-blue-700 mb-4 md:mb-6">Captains Selection</h2>

      <!-- Manual Captain Assignment -->
      <div v-if="!captainsAssigned && canAssignCaptains" class="mb-4 md:mb-6">
        <h3 class="text-base md:text-lg font-semibold text-gray-700 mb-3 md:mb-4">Select Two Different Captains:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-4">
          <div class="relative flex items-center space-x-2">
            <select v-model="selectedCaptain1" class="bg-white border border-gray-300 p-2 rounded-full shadow-sm w-full">
              <option value="" disabled>Select Captain 1</option>
              <option v-for="player in availableCaptains" :key="player.id" :value="player">{{ player.name }}</option>
            </select>
            <img
                v-if="selectedCaptain1"
                src="@/assets/soccer.png"
                alt="Captain 1"
                class="w-8 h-8 rounded-full border border-gray-300"
            />
          </div>
          <div class="relative flex items-center space-x-2">
            <select v-model="selectedCaptain2" class="bg-white border border-gray-300 p-2 rounded-full shadow-sm w-full">
              <option value="" disabled>Select Captain 2</option>
              <option v-for="player in availableCaptains" :key="player.id" :value="player">{{ player.name }}</option>
            </select>
            <img
                v-if="selectedCaptain2"
                src="@/assets/soccer.png"
                alt="Captain 2"
                class="w-8 h-8 rounded-full border border-gray-300"
            />
          </div>
        </div>
        <p v-if="selectedCaptain1 && selectedCaptain2 && selectedCaptain1.id === selectedCaptain2.id" class="text-red-600 mb-3 md:mb-4">
          Error: The same player cannot be assigned as both captains. Please select two different captains.
        </p>
        <button
            class="bg-blue-600 text-white py-2 px-4 md:py-3 md:px-6 rounded-full hover:bg-blue-700 transition mb-4 md:mb-6 text-base md:text-lg font-medium"
            @click="assignSelectedCaptains" :disabled="!canAssignSelectedCaptains">
          Assign Captains
        </button>
      </div>

      <!-- Assigned Captains Display -->
      <div v-if="captainsAssigned" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div v-for="captain in captains" :key="captain.id" class="p-4 md:p-5 bg-blue-50 rounded-xl md:rounded-2xl shadow-md">
          <h3 class="text-lg md:text-xl font-bold text-blue-800">{{ captain.name }} (Captain)</h3>
          <p class="text-sm md:text-base text-gray-700 mb-3 md:mb-4">
            Turn to pick:
            <span :class="captain.turnToPick ? 'text-green-600' : 'text-red-600'">
    {{ captain.turnToPick ? 'Yes' : 'No' }}
  </span>
          </p>
          <div class="mb-3 md:mb-4">
            <h4 class="text-xs md:text-sm font-semibold text-gray-800">Picked Players:</h4>
            <ul class="list-disc list-inside text-gray-700 ml-4">
              <li v-for="player in captain.team?.filter((p) => p.id !== captain.id) || []" :key="player.id" class="flex items-center space-x-2">
                <img
                    src="@/assets/soccer.png"
                    alt="Player"
                    class="w-6 h-6 rounded-full border border-gray-300"
                />
                <span>{{ player.name }}</span>

                <!-- Show Deselect button only if the current user is the captain -->
                <button
                    v-if="canInteractWithCaptain(captain)"
                    class="bg-red-500 text-white px-2 py-1 rounded-full text-xs hover:bg-red-600 transition"
                    @click="deselectPlayer(captain, player)">
                  Deselect
                </button>
              </li>
            </ul>

          </div>
          <button v-for="player in filteredAvailablePlayers"
                  :key="player.id"
                  class="bg-gray-200 py-2 px-4 rounded-full text-xs md:text-sm mt-2 hover:bg-gray-300 transition"
                  @click="pickPlayer(captain, player)"
                  :disabled="!captain.turnToPick || !canInteractWithCaptain(captain)">
            Pick {{ player.name }}
          </button>


        </div>
      </div>
    </div>

    <!-- Attendance Section -->
    <div class="w-full max-w-xl md:max-w-3xl bg-white p-4 sm:p-6 rounded-xl md:rounded-2xl shadow-lg mb-6 md:mb-8">
      <h2 class="text-2xl md:text-3xl font-semibold text-blue-700 mb-4 md:mb-6">Indicate Your Attendance</h2>
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <p class="text-lg md:text-2xl font-semibold text-gray-700 mb-2 sm:mb-0">
          Total Players: {{ totalPlayers }}
        </p>
        <p class="text-lg md:text-2xl font-semibold text-gray-700">
          Players Going: {{ playersGoing }}
        </p>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
        <div
            v-for="player in players"
            :key="player.id"
            :class="[
            'p-3 rounded-lg shadow-md flex flex-col items-center',
            currentUserEmail === player.email ? 'bg-yellow-200 border-4 border-yellow-500' : 'bg-white'
          ]"
        >
          <img src="@/assets/soccer.png" alt="Player" class="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-blue-500 mb-2" />
          <span class="text-center text-xs md:text-sm font-semibold mb-1 md:mb-2">{{ player.name }}</span>

          <!-- Display button only for the logged-in user matching the player -->
          <button
              v-if="canToggleAttendance(player)"
              :class="[
              'py-2 px-3 md:px-4 rounded-full text-xs md:text-sm font-medium transition-all',
              player.attending === 'Going' ? 'bg-green-500 text-white' : '',
              player.attending === 'Not Going' ? 'bg-red-500 text-white' : '',
              !player.attending ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : ''
            ]"
              @click="toggleAttendance(player)">
            {{ player.attending || 'Select' }}
          </button>

          <!-- Display status text for other players without the button -->
          <span
              v-else
              :class="[
              'text-xs md:text-sm font-medium',
              player.attending === 'Going' ? 'text-green-500' : '',
              player.attending === 'Not Going' ? 'text-red-500' : '',
              !player.attending ? 'text-gray-500' : ''
            ]">
            {{ player.attending || 'Pending' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';

const players = ref([]);
const captains = ref([]);
const captainsAssigned = ref(false);
const captainTurn = ref(null);
const availablePlayers = ref([]);
const currentUserEmail = ref(null);
const designatedEmail = 'ds7513635@gmail.com';

const today = ref('');
const lastResetDate = ref(null); // To store the last reset date

// Variables for manual captain selection
const selectedCaptain1 = ref(null);
const selectedCaptain2 = ref(null);

// Fetch logged-in user email
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserEmail.value = user.email;
  } else {
    currentUserEmail.value = null;
  }
});

// Real-time listener for players and captains
const fetchPlayers = async () => {
  onSnapshot(collection(db, 'users'), (snapshot) => {
    players.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    updateAvailablePlayers();
  });

  onSnapshot(collection(db, 'captains'), (snapshot) => {
    captains.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    captainsAssigned.value = captains.value.length > 0;
    updateAvailablePlayers();
  });

  onSnapshot(doc(db, 'game', 'turnState'), (doc) => {
    if (doc.exists()) {
      captainTurn.value = doc.data().currentTurn || captains.value[0]?.id;
      lastResetDate.value = doc.data().lastResetDate || null;
    } else {
      captainTurn.value = captains.value[0]?.id || null;
    }
  });


  checkAndResetDaily();
};
// Function to send notifications
const sendNotification = async (message) => {
  const headers = {
    'Authorization': 'Bearer MzVkYmJkODUtOTBmMS00ZmM2LWFkZTgtMzcwNTRjODlhY2Y4',
    'Content-Type': 'application/json'
  };

  const data = {
    "app_id": "fc206a71-7d65-4cfa-b8b2-0c10548e1476",  // Updated app ID
    "included_segments": ["All"],  // Sends to all users
    "contents": {"en": message}
  };

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', data, { headers });
    console.log('Notification sent:', message);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
// Function to check if a new day has started and reset if needed
const checkAndResetDaily = async () => {
  const currentDate = new Date().toLocaleDateString();
  if (lastResetDate.value !== currentDate) {
    await resetGame();
    lastResetDate.value = currentDate;
    await updateDoc(doc(db, 'game', 'turnState'), { lastResetDate: currentDate });
  }
};

// Update available players to exclude captains and their picked players
const updateAvailablePlayers = () => {
  availablePlayers.value = players.value.filter(
      (p) =>
          p.attending === 'Going' &&
          !captains.value.some((c) => c.team?.some((tp) => tp.id === p.id) || c.id === p.id)
  );
};

// Computed properties to track total players and players going
const totalPlayers = computed(() => players.value.length);
const playersGoing = computed(() => players.value.filter((p) => p.attending === 'Going').length);

// Check if the logged-in user can toggle attendance for a player
const canToggleAttendance = (player) => {
  return currentUserEmail.value === player.email;
};

// Check if the logged-in user can assign captains
const canAssignCaptains = computed(() => currentUserEmail.value === designatedEmail);

// Filter available captains for selection (only players marked as going)
const availableCaptains = computed(() => players.value.filter((p) => p.attending === 'Going'));

// Filter available players for picking by excluding the captains
const filteredAvailablePlayers = computed(() => {
  return availablePlayers.value.filter(
      (player) => player.id !== selectedCaptain1.value?.id && player.id !== selectedCaptain2.value?.id
  );
});

// Check if two different captains have been selected
const canAssignSelectedCaptains = computed(() => {
  return (
      selectedCaptain1.value &&
      selectedCaptain2.value &&
      selectedCaptain1.value.id !== selectedCaptain2.value.id
  );
});

// Check if the logged-in user can interact with the captain's pick buttons
const canInteractWithCaptain = (captain) => {
  return currentUserEmail.value === captain.email;
};



// Assign two different captains and save them to Firebase
const assignSelectedCaptains = async () => {
  if (!canAssignSelectedCaptains.value) return;

  captains.value = [selectedCaptain1.value, selectedCaptain2.value];
  captainsAssigned.value = true;
  updateAvailablePlayers();

  await setDoc(doc(db, 'captains', selectedCaptain1.value.id), {
    ...selectedCaptain1.value,
    team: [],
    turnToPick: true  // Captain 1 starts with turn to pick
  });
  await setDoc(doc(db, 'captains', selectedCaptain2.value.id), {
    ...selectedCaptain2.value,
    team: [],
    turnToPick: false  // Captain 2 does not start
  });

  // Send notification
  sendNotification(`Captains selected: ${selectedCaptain1.value.name} and ${selectedCaptain2.value.name}.`);
};



// Captain picks a player and updates the team
// Player picked by captain and send notification
const pickPlayer = async (captain, player) => {
  captain.team = captain.team || [];
  captain.team.push(player);
  updateAvailablePlayers();

  const otherCaptain = captains.value.find((c) => c.id !== captain.id);

  await updateDoc(doc(db, 'captains', captain.id), {
    team: captain.team,
    turnToPick: false  // Captain who picked loses the turn
  });
  await updateDoc(doc(db, 'captains', otherCaptain.id), {
    turnToPick: true  // The other captain gains the turn
  });

  // Send notification
  sendNotification(`${captain.name} picked ${player.name}.`);
};



// Captain deselects a player and updates the team
// Player deselected by captain and send notification
const deselectPlayer = async (captain, player) => {
  captain.team = captain.team.filter((p) => p.id !== player.id);
  updateAvailablePlayers();

  await updateDoc(doc(db, 'captains', captain.id), { team: captain.team });

  // Send notification
  sendNotification(`${captain.name} deselected ${player.name}.`);
};

// Reset the game
const resetGame = async () => {
  for (const player of players.value) {
    await updateDoc(doc(db, 'users', player.id), { attending: null });
  }

  captains.value = [];
  captainsAssigned.value = false;
  captainTurn.value = null;
  selectedCaptain1.value = null;
  selectedCaptain2.value = null;

  await setDoc(doc(db, 'game', 'turnState'), { currentTurn: null, lastResetDate: null });
  updateAvailablePlayers();

  // Send notification
  sendNotification('A new game has been scheduled!');
};

// Toggle attendance and send notification
const toggleAttendance = async (player) => {
  if (!canToggleAttendance(player)) return;

  const newStatus = player.attending === 'Going' ? 'Not Going' : 'Going';
  await updateDoc(doc(db, 'users', player.id), { attending: newStatus });

  // Send notification
  const statusMessage = `${player.name} is now ${newStatus === 'Going' ? 'going' : 'not going'} to the game.`;
  sendNotification(statusMessage);
};


// Fetch players and game state data on component mount
onMounted(fetchPlayers);
onMounted(() => {
  const date = new Date();
  today.value = date.toLocaleDateString();
});
</script>



<style scoped>
body {
  font-family: 'Arial', sans-serif;
}
</style>
