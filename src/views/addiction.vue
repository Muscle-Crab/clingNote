<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto bg-white/70 backdrop-blur-md shadow-2xl rounded-2xl p-8 transition-all duration-300">
      <h1 class="text-4xl font-extrabold text-center text-indigo-800 mb-8 tracking-tight">🌱 Recovery Tracker</h1>

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
import {ref, computed, onMounted} from 'vue'
import {auth, db} from '@/firebaseConfig'
import {onAuthStateChanged} from 'firebase/auth'
import {doc, getDoc, updateDoc, setDoc, arrayUnion} from 'firebase/firestore'

const addictionType = ref('Porn')
const addictionLocked = ref(false)
const streak = ref(0)
const retentionDays = ref([])
const relapseDays = ref([])
const allowedRelapseDay = ref('Sunday')
const goal = 30
const lastPromptedDate = ref(null)
const userId = ref(null)

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
async function speakDailyCheck() {
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

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId.value = user.uid

      // Load their existing data or create default structure
      const userRef = doc(db, 'users', user.uid, 'nofap', 'tracker')
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        addictionType.value = data.addictionType || addictionType.value
        streak.value = data.streak || 0
        retentionDays.value = data.retentionDays || []
        relapseDays.value = data.relapseDays || []
        addictionLocked.value = !!data.addictionType
      } else {
        await setDoc(userRef, {
          addictionType: addictionType.value,
          streak: 0,
          retentionDays: [],
          relapseDays: [],
          lastVoicePrompt: null
        })
      }

      speakDailyCheck()
    }
  })
})

const nextFreeDayCountdown = computed(() => {
  const todayIndex = new Date().getDay()
  const freeIndex = daysOfWeek.indexOf(allowedRelapseDay.value)
  return (freeIndex - todayIndex + 7) % 7 || 7
})
function getEmojiForDay(index) {
  const dayStr = getTodayStr(index - new Date().getDay())
  if (relapseDays.value.includes(dayStr)) return '🚫'
  if (retentionDays.value.includes(dayStr)) return '✅'
  return ''
}
function markDay(didMasturbate) {
  if (!userId.value) {
    console.warn('User not authenticated yet.')
    return
  }

  const yesterdayStr = getTodayStr(-1)
  const dayName = daysOfWeek[new Date().getDay() - 1 < 0 ? 6 : new Date().getDay() - 1]
  const userRef = doc(db, 'users', userId.value, 'nofap', 'tracker')

  if (didMasturbate) {
    if (!relapseDays.value.includes(yesterdayStr)) relapseDays.value.push(yesterdayStr)
    if (dayName !== allowedRelapseDay.value) {
      streak.value = 0
      speakStrictMessage()
    }
    updateDoc(userRef, {
      relapseDays: arrayUnion(yesterdayStr),
      streak: streak.value
    })
  } else {
    if (!retentionDays.value.includes(yesterdayStr)) retentionDays.value.push(yesterdayStr)
    streak.value++
    speakSuccessMessage()
    updateDoc(userRef, {
      retentionDays: arrayUnion(yesterdayStr),
      streak: streak.value
    })
  }
}


function getTodayStr(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split('T')[0]
}
function speakStrictMessage() {
  const msg = new SpeechSynthesisUtterance("You failed. This is serious. Focus. You can do better tomorrow. Stay disciplined.")
  speechSynthesis.speak(msg)
}

function speakSuccessMessage() {
  const msg = new SpeechSynthesisUtterance("Good job staying clean. Keep going. You're building strength every day.")
  speechSynthesis.speak(msg)
}

function lockAddiction() {
  addictionLocked.value = true
  if (userId.value) {
    const userRef = doc(db, 'users', userId.value, 'nofap', 'tracker')
    updateDoc(userRef, {addictionType: addictionType.value})
  }
}
</script>
