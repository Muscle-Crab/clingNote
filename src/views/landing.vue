<template>
 <div>
 
 </div>
</template>

<script setup>
import { ref } from 'vue';

const players = ref([
  { id: 1, name: 'Player 1', attending: null },
  { id: 2, name: 'Player 2', attending: null },
  { id: 3, name: 'Player 3', attending: null },
  { id: 4, name: 'Player 4', attending: null },
  { id: 5, name: 'Player 5', attending: null },
  { id: 6, name: 'Player 6', attending: null },
  { id: 7, name: 'Player 7', attending: null },
  { id: 8, name: 'Player 8', attending: null },
  { id: 9, name: 'Player 9', attending: null },
  { id: 10, name: 'Player 10', attending: null },
]);

const captains = ref([]);
const captainsAssigned = ref(false);
const captainTurn = ref(null);
const availablePlayers = ref([]);

const toggleAttendance = (player) => {
  player.attending = player.attending === 'Going' ? 'Not Going' : 'Going';
};

const assignCaptains = () => {
  const goingPlayers = players.value.filter((p) => p.attending === 'Going');
  captains.value = [goingPlayers[0], goingPlayers[1]];
  captainsAssigned.value = true;
  availablePlayers.value = goingPlayers.slice(2);
  captainTurn.value = captains.value[0].id;
};

const pickPlayer = (captain, player) => {
  captain.team = captain.team || [];
  captain.team.push(player);
  availablePlayers.value = availablePlayers.value.filter((p) => p.id !== player.id);
  captainTurn.value = captainTurn.value === captains.value[0].id ? captains.value[1].id : captains.value[0].id;
};
</script>

<style scoped>
body {
  font-family: 'Arial', sans-serif;
}
</style>
