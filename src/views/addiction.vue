<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto bg-white/70 backdrop-blur-md shadow-2xl rounded-2xl p-8 transition-all duration-300">
      <h1 class="text-4xl font-extrabold text-center text-indigo-800 mb-8 tracking-tight">🌱 Recovery Tracker</h1>

      <!-- Addiction Selection -->
      <div class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">What are you quitting?</label>
        <select v-model="addictionType" class="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400">
          <option>Porn</option>
          <option>Smoking</option>
          <option>Sugar</option>
          <option>Social Media</option>
          <option>Gaming</option>
        </select>
      </div>

      <!-- Motivational Quote -->
      <div class="mb-6 bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg text-indigo-800 font-medium text-center text-sm shadow-sm">
        <strong>Quote of the Day:</strong> "{{ dailyQuote }}"
      </div>

      <!-- Days of the week -->
      <div class="mb-8 flex justify-between items-center px-4 py-3 bg-gradient-to-r from-indigo-100 to-indigo-200 rounded-xl shadow-sm">
        <div v-for="(day, index) in daysOfWeek" :key="day" class="text-center flex-1">
          <div :class="['text-sm font-semibold', currentDayIndex === index ? 'text-indigo-800' : 'text-gray-400']">
            {{ day.slice(0, 3) }}
          </div>
          <div class="text-2xl mt-1">
            <span v-if="getEmojiForDay(index)">{{ getEmojiForDay(index) }}</span>
          </div>
        </div>
      </div>

      <!-- Daily Check-in -->
      <div class="mb-6">
        <label class="block text-lg font-semibold text-gray-700 mb-3">Did you engage yesterday?</label>
        <div class="flex gap-4">
          <button @click="markDay(true)" class="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow transition-all duration-200">Yes</button>
          <button @click="markDay(false)" class="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow transition-all duration-200">No</button>
        </div>
      </div>

      <!-- Free Day Selection -->
      <div class="mb-6">
        <label class="block text-md font-semibold text-gray-700 mb-2">Allowed free day (won't affect streak):</label>
        <select v-model="allowedRelapseDay" class="w-full p-3 border border-gray-300 rounded-xl focus:ring focus:ring-indigo-300">
          <option v-for="day in daysOfWeek" :key="day" :value="day">{{ day }}</option>
        </select>
        <p class="text-xs text-gray-500 mt-1">Next free day in <strong>{{ nextFreeDayCountdown }}</strong> day(s)</p>
      </div>

      <!-- Progress Tracking -->
      <div class="mb-4">
        <h2 class="text-xl font-bold text-gray-800 mb-2">Your Progress</h2>
        <p class="text-gray-700 mb-1">Streak: <span class="font-bold text-indigo-700">{{ streak }}</span> day(s)</p>
        <p class="text-gray-700 mb-1">Retention Days: <span class="font-semibold">{{ retentionDays.length }}</span></p>
        <p class="text-gray-700 mb-2">Relapse Days: <span class="font-semibold">{{ relapseDays.length }}</span></p>
        <div class="h-5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div class="h-full bg-indigo-500 transition-all duration-300" :style="{ width: streakProgress + '%' }"></div>
        </div>
        <p class="text-sm text-right mt-1 text-gray-500">Progress: {{ Math.round(streakProgress) }}%</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const addictionType = ref('Porn')
const streak = ref(0)
const retentionDays = ref([])
const relapseDays = ref([])
const allowedRelapseDay = ref('Sunday')
const goal = 30

const quotes = [
  "Progress, not perfection.",
  "One day at a time.",
  "You’re stronger than your urges.",
  "Discipline is freedom.",
  "Every day is a fresh start.",
  "Quitting isn’t easy, but neither is regret."
]

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const currentDayIndex = computed(() => new Date().getDay())
const streakProgress = computed(() => (streak.value / goal) * 100)

const dailyQuote = computed(() => {
  const index = new Date().getDate() % quotes.length
  return quotes[index]
})

const nextFreeDayCountdown = computed(() => {
  const todayIndex = new Date().getDay()
  const freeIndex = daysOfWeek.indexOf(allowedRelapseDay.value)
  return (freeIndex - todayIndex + 7) % 7 || 7
})

function markDay(didMasturbate) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const yesterdayDayName = daysOfWeek[yesterday.getDay()]

  if (didMasturbate) {
    if (!relapseDays.value.includes(yesterdayStr)) relapseDays.value.push(yesterdayStr)
    if (yesterdayDayName !== allowedRelapseDay.value) {
      streak.value = 0
    }
  } else {
    if (!retentionDays.value.includes(yesterdayStr)) {
      retentionDays.value.push(yesterdayStr)
      streak.value++
    }
  }
}

function getEmojiForDay(index) {
  const today = new Date()
  const dayDate = new Date()
  const diff = index - today.getDay()
  dayDate.setDate(today.getDate() + diff)
  const dayStr = dayDate.toISOString().split('T')[0]

  if (relapseDays.value.includes(dayStr)) return '🚫'
  if (retentionDays.value.includes(dayStr)) {
    if (streak.value >= 30) return '🏔️'
    if (streak.value >= 20) return '🌲'
    if (streak.value >= 10) return '🌳'
    if (streak.value >= 5) return '🌿'
    return '🌱'
  }
  return ''
}
</script>

<style>
body {
  @apply bg-gray-50 font-sans antialiased;
}
</style>
