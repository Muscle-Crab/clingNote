<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto bg-white/70 backdrop-blur-md shadow-2xl rounded-2xl p-8 transition-all duration-300">
      <h1 class="text-4xl font-extrabold text-center text-indigo-800 mb-8 tracking-tight">🌱 Recovery Tracker</h1>
      <!-- Fuel Tank -->
      <div class="mb-4">
        <h2 class="text-xl font-bold text-gray-800 mb-2 flex items-center justify-between">
          Fuel Tank
          <span v-if="fuel === 100" class="text-red-500 text-2xl animate-pulse">🔥</span>
        </h2>
        <div class="relative h-6 bg-gray-300 rounded-full overflow-hidden shadow-inner">
          <div
              class="absolute top-0 left-0 h-full transition-all duration-1000 ease-out"
              :class="{
        'bg-green-500': fuel >= 60,
        'bg-yellow-400': fuel < 60 && fuel >= 30,
        'bg-red-500': fuel < 30
      }"
              :style="{ width: fuel + '%' }"
          ></div>
          <!-- Optional animated bubbles or overlay could go here -->
        </div>
        <p class="text-sm text-right mt-1 text-gray-600">Fuel: {{ fuel }}%</p>
      </div>
      <!-- Addiction Selection -->
      <div class="mb-6" v-if="!addictionLocked">
        <label class="block text-gray-700 font-medium mb-2">What are you quitting?</label>
        <select v-model="addictionType" @change="lockAddiction" class="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400">
          <option>Porn</option>
          <option>Smoking</option>
          <option>Sugar</option>
          <option>Social Media</option>
          <option>Gaming</option>
        </select>
      </div>
      <div v-else class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">Addiction Tracked:</label>
        <div class="p-3 bg-indigo-100 rounded-xl text-indigo-700 font-semibold shadow-inner">{{ addictionType }}</div>
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
            <span>{{ getEmojiForDay(index) }}</span>
          </div>
        </div>
      </div>

      <!-- Daily Check-in -->
      <div v-if="!hasAnsweredYesterday" class="mb-6">
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
      <div class="mb-6 bg-white/60 rounded-2xl shadow-lg p-5 transition-all duration-300 border border-indigo-100">
        <h2 class="text-2xl font-extrabold text-indigo-700 mb-4 flex items-center gap-2">
          📈 Your Progress
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div class="bg-indigo-50 rounded-xl p-4 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Current Streak</p>
            <p class="text-2xl font-bold text-indigo-700">{{ streak }}🔥</p>
          </div>

          <div class="bg-green-50 rounded-xl p-4 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Retention Days</p>
            <p class="text-2xl font-semibold text-green-600">{{ retentionDays.length }} ✅</p>
          </div>

          <div class="bg-red-50 rounded-xl p-4 shadow-sm">
            <p class="text-sm text-gray-500 mb-1">Relapse Days</p>
            <p class="text-2xl font-semibold text-red-500">{{ relapseDays.length }} 🚫</p>
          </div>
        </div>

        <div class="mt-6">
          <p class="text-sm text-gray-600 font-medium mb-2">Streak Progress</p>
          <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div
                class="h-full bg-indigo-500 transition-all duration-500"
                :style="{ width: streakProgress + '%' }"
            ></div>
          </div>
          <p class="text-xs text-right text-gray-500 mt-1">
            {{ Math.round(streakProgress) }}% toward 30-day goal
          </p>
        </div>
      </div>




    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { auth, db } from '@/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore'

const addictionType = ref('Porn')
const addictionLocked = ref(false)
const streak = ref(0)
const retentionDays = ref([])
const relapseDays = ref([])
const allowedRelapseDay = ref('Sunday')
const goal = 30
const userId = ref(null)
const fuel = ref(100)

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
const dailyQuote = computed(() => quotes[new Date().getDate() % quotes.length])
const hasAnsweredYesterday = computed(() => {
  const y = getTodayStr(-1)
  return retentionDays.value.includes(y) || relapseDays.value.includes(y)
})

const nextFreeDayCountdown = computed(() => {
  const todayIndex = new Date().getDay()
  const freeIndex = daysOfWeek.indexOf(allowedRelapseDay.value)
  return (freeIndex - todayIndex + 7) % 7 || 7
})

function getTodayStr(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split('T')[0]
}

function getEmojiForDay(index) {
  const dayStr = getTodayStr(index - new Date().getDay())
  if (relapseDays.value.includes(dayStr)) return '🚫'
  if (retentionDays.value.includes(dayStr)) return '✅'
  return ''
}

function speakStrictMessage() {
  const msg = new SpeechSynthesisUtterance("You failed. This is serious. Focus. You can do better tomorrow. Stay disciplined.")
  speechSynthesis.speak(msg)
}

function speakSuccessMessage() {
  const msg = new SpeechSynthesisUtterance("Good job staying clean. Keep going. You're building strength every day.")
  speechSynthesis.speak(msg)
}

function markDay(didMasturbate) {
  if (!userId.value) return

  const yesterdayStr = getTodayStr(-1)
  const yesterdayIndex = new Date().getDay() - 1 < 0 ? 6 : new Date().getDay() - 1
  const dayName = daysOfWeek[yesterdayIndex]
  const userRef = doc(db, 'users', userId.value, 'nofap', 'tracker')

  if (retentionDays.value.includes(yesterdayStr) || relapseDays.value.includes(yesterdayStr)) return

  if (didMasturbate) {
    relapseDays.value.push(yesterdayStr)
    if (dayName !== allowedRelapseDay.value) {
      streak.value = 0
      fuel.value = Math.max(fuel.value - 20, 0) // Reduce fuel on relapse
      speakStrictMessage()
    }
    updateDoc(userRef, {
      relapseDays: arrayUnion(yesterdayStr),
      streak: streak.value,
      fuel: fuel.value
    })
  } else {
    retentionDays.value.push(yesterdayStr)
    streak.value++
    speakSuccessMessage()
    updateDoc(userRef, {
      retentionDays: arrayUnion(yesterdayStr),
      streak: streak.value,
      fuel: fuel.value
    })
  }
}

async function speakDailyCheck() {
  const today = new Date()
  if (today.getDay() === 1) return // Monday (don't ask since Sunday is free)

  const todayStr = getTodayStr()
  const userRef = doc(db, 'users', userId.value, 'nofap', 'tracker')
  const snap = await getDoc(userRef)

  if (!snap.exists()) return
  const data = snap.data()
  if (data.lastVoicePrompt === todayStr) return

  const main = new SpeechSynthesisUtterance("Did you engage yesterday?")
  main.onend = async () => {
    if (addictionType.value.toLowerCase() === 'porn') {
      const followUp = new SpeechSynthesisUtterance("Did you watch any porn-related videos?")
      speechSynthesis.speak(followUp)
    }
    await updateDoc(userRef, { lastVoicePrompt: todayStr })
  }
  speechSynthesis.speak(main)
}

function lockAddiction() {
  addictionLocked.value = true
  if (userId.value) {
    const userRef = doc(db, 'users', userId.value, 'nofap', 'tracker')
    updateDoc(userRef, { addictionType: addictionType.value })
  }
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId.value = user.uid
      const userRef = doc(db, 'users', user.uid, 'nofap', 'tracker')
      const snap = await getDoc(userRef)

      if (snap.exists()) {
        const data = snap.data()
        addictionType.value = data.addictionType || addictionType.value
        streak.value = data.streak || 0
        retentionDays.value = data.retentionDays || []
        relapseDays.value = data.relapseDays || []
        fuel.value = data.fuel ?? 100
        addictionLocked.value = !!data.addictionType
      } else {
        await setDoc(userRef, {
          addictionType: addictionType.value,
          streak: 0,
          retentionDays: [],
          relapseDays: [],
          lastVoicePrompt: null,
          fuel: 100
        })
      }

      // Refill fuel on Sunday
      if (new Date().getDay() === 0) {
        fuel.value = 100
        await updateDoc(userRef, { fuel: 100 })
      }

      speakDailyCheck()
    }
  })
})
</script>

