<template>
  <div class="p-4 sm:p-6 max-w-xl mx-auto text-gray-100 bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen space-y-8 font-sans">
    <!-- Title -->
    <h1 class="text-2xl sm:text-4xl font-extrabold text-center tracking-tight">📊 Track Daily Nutrients with AI</h1>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center space-y-4">
      <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-lg font-medium text-white animate-pulse">Analyzing image...</p>
    </div>
    <div class="bg-gray-800/70 backdrop-blur rounded-xl p-5 shadow-lg space-y-4 text-white">
      <!-- Header/Instruction -->
      <div class="text-center space-y-1">
        <h2 class="text-lg sm:text-xl font-semibold">📤 Upload Your Meal Image</h2>
        <p class="text-sm text-gray-400">Tap to select or drag an image of your meal</p>
      </div>

      <!-- Upload Box -->
      <label
          class="flex flex-col items-center justify-center border-2 border-dashed border-blue-500/50 hover:border-blue-400 transition rounded-xl p-6 cursor-pointer bg-gray-900/50"
      >
        <input type="file" @change="onImageUpload" accept="image/*" class="hidden" />
        <div v-if="previewImageURL" class="w-32 h-32 rounded-lg overflow-hidden border border-gray-700 shadow-md mb-3">
          <img :src="previewImageURL" alt="Preview" class="w-full h-full object-cover" />
        </div>
        <div v-else class="flex flex-col items-center gap-2 text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 15a4 4 0 104 4H5a2 2 0 01-2-2v-2a2 2 0 012-2h2a4 4 0 00-4-4m9-4l3 3m0 0l-3 3m3-3H4" />
          </svg>
          <span class="text-sm font-medium">Click to upload image</span>
        </div>
      </label>

      <!-- Analyze Button -->
      <div class="text-center">
        <button
            @click="analyzeImage"
            :disabled="!image || isLoading"
            :class="[
        'w-full sm:w-auto px-5 py-2 rounded-lg text-white font-semibold shadow-md transition duration-200',
        (!image || isLoading)
          ? 'bg-gray-600 cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90'
      ]"
        >
          🔍 Analyze Image
        </button>
      </div>
    </div>


    <!-- Alerts -->
    <div v-if="alerts.length" class="bg-red-900/30 border border-red-600 text-red-400 p-4 rounded-lg shadow-inner">
      <h3 class="font-bold mb-2 text-red-300">⚠️ Health Alerts</h3>
      <ul class="space-y-1 text-sm list-disc list-inside">
        <li v-for="(alert, index) in alerts" :key="index">{{ alert }}</li>
      </ul>
    </div>

    <!-- Nutrient Stats -->
    <div class="bg-gray-800/80 backdrop-blur p-5 rounded-xl shadow-md">
      <h2 class="text-lg font-semibold mb-4">🚨 Daily Nutrients</h2>
      <div v-for="(value, key) in displayNutrients" :key="key" class="mb-4">
        <div class="flex justify-between text-sm mb-1">
          <span>{{ key }}</span>
          <span>{{ value }}%</span>
        </div>
        <div class="w-full h-2 bg-gray-700 rounded overflow-hidden">
          <div
              :class="{
              'bg-blue-500': key === 'Carbs',
              'bg-purple-400': key === 'Protein',
              'bg-yellow-400': key === 'Fat'
            }"
              class="h-2 transition-all duration-300"
              :style="{ width: value + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Meal History -->
    <div class="bg-gray-800/80 backdrop-blur p-5 rounded-xl shadow-md">
      <h2 class="text-lg font-semibold mb-4">🍽 Meal History</h2>
      <div class="grid gap-3">
        <div
            v-for="(item, idx) in mealHistory"
            :key="idx"
            @click="selectedMeal = item"
            class="flex items-center gap-4 p-3 rounded-lg border border-gray-700 bg-gray-900/50 cursor-pointer hover:bg-gray-800 transition"
        >
          <img v-if="item.image" :src="item.image" alt="Meal Image" class="w-14 h-14 object-cover rounded shadow" />
          <div class="flex-1 min-w-0">
            <span class="text-sm text-gray-300 block font-medium truncate">{{ item.name }}</span>
            <span class="text-xs text-gray-400">Click to view details</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Meal Details Modal -->
    <div
        v-if="selectedMeal"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-2 py-6 sm:px-4"
        @click.self="selectedMeal = null"
    >
      <div class="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-lg border border-white/10 text-white rounded-2xl p-6 w-full max-w-md max-h-full overflow-y-auto shadow-2xl space-y-6">
        <!-- Header -->
        <div class="flex justify-between items-center border-b border-white/10 pb-2">
          <h3 class="text-2xl font-semibold tracking-tight">🍱 Meal Overview</h3>
          <button @click="selectedMeal = null" class="text-white/60 hover:text-white text-3xl leading-none">&times;</button>
        </div>

        <!-- Image -->
        <img v-if="selectedMeal.image" :src="selectedMeal.image" class="w-full h-48 object-cover rounded-lg border border-white/10 shadow-md" />

        <!-- Food List -->
        <div>
          <p class="text-sm font-medium text-white/70 mb-1">Foods:</p>
          <ul class="list-disc list-inside text-sm space-y-1 text-white/90">
            <li v-for="(food, i) in selectedMeal.foods" :key="i">{{ food.name }}</li>
          </ul>
        </div>

        <!-- Nutrients -->
        <div>
          <p class="text-sm font-medium text-white/70 mb-2">Nutrients:</p>
          <div class="flex flex-wrap gap-2">
            <span
                v-for="(val, key) in selectedMeal.nutrients"
                :key="key"
                class="bg-blue-600/80 hover:bg-blue-500/90 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm transition"
            >
              {{ key }}: {{ formatNutrient(val, key) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



<script setup>
import { ref, reactive, onMounted } from 'vue'
import { db, auth} from '@/firebaseConfig.js'
import { collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import axios from 'axios'
import { onAuthStateChanged } from 'firebase/auth'
const openaiKey = process.env.VUE_APP_OPENAI_API_KEY
const image = ref(null)
const manualFood = ref('')
const mealHistory = ref([])
const alerts = ref([])
const dailyNutrients = reactive({})
const userId = ref(null)
const displayNutrients = reactive({ Carbs: 0, Protein: 0, Fat: 0 })
const previewImageURL = ref(null)
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
const selectedMeal = ref(null)

const weeklyData = reactive([
  { day: 'Sun', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
  { day: 'Mon', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
  { day: 'Tue', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
  { day: 'Wed', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
  { day: 'Thu', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
  { day: 'Fri', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
  { day: 'Sat', Carbs: 0, Protein: 0, Fat: 0, Percent: 0 },
])

const limits = {
  Sugar: 50, Fat: 70, Sodium: 2300, VitaminC: 2000, VitaminD: 4000
}
const isLoading = ref(false)

function onImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  image.value = file
  previewImageURL.value = URL.createObjectURL(file)
}
function formatNutrient(val, key) {
  const units = {
    calories: 'kcal',
    protein: 'g',
    carbs: 'g',
    fat: 'g',
    fiber: 'g',
    sugar: 'g',
    sodium: 'mg',
    vitaminC: 'mg',
    vitaminD: 'mcg',
  }

  const unitKey = key.toLowerCase();
  const formattedVal = parseFloat(val).toFixed(1);
  const unit = units[unitKey] || '';

  return `${formattedVal}${unit ? ' ' + unit : ''}`;
}

async function analyzeImage() {
  isLoading.value = true
  try {
    const base64 = await toBase64(image.value)
    const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `List all foods in this image and estimate their nutrient content (Calories, Protein, Fat, Carbs, Sugar, Sodium, Fiber, VitaminC, VitaminD). Return a JSON array like:
[
  {"name": "Banana", "Calories": 100, "Carbs": 27, "Protein": 1.3, "Fat": 0.3, "Sugar": 14, "Sodium": 1, "Fiber": 3.1, "VitaminC": 8.7, "VitaminD": 0}
]`
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64}` }
                }
              ]
            }
          ],
          max_tokens: 1000
        },
        { headers: { Authorization: `Bearer ${openaiKey}` } }
    )

    let content = res.data.choices[0].message.content.trim()
    if (content.startsWith('```')) {
      content = content.replace(/```(?:json)?/g, '').trim()
    }

    const foods = JSON.parse(content)
    await processNutrients(foods)
  } catch (err) {
    console.error('Image analysis failed:', err)
  } finally {
    isLoading.value = false
  }
}


function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = error => reject(error)
  })
}

async function addManualFood() {
  if (!manualFood.value.trim()) return

  const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: `Estimate these nutrients (Calories, Protein, Fat, Carbs, Sugar, Sodium, Fiber, VitaminC, VitaminD) for this food: ${manualFood.value}. Return a JSON object.`
          }
        ],
        max_tokens: 500
      },
      { headers: { Authorization: `Bearer ${openaiKey}` } }
  )

  let content = res.data.choices[0].message.content.trim()
  if (content.startsWith('```')) {
    content = content.replace(/```(?:json)?/g, '').trim()
  }

  const food = JSON.parse(content)
  await processNutrients([food])
  manualFood.value = ''
  previewImageURL.value = ''
}

async function processNutrients(foods) {
  alerts.value = []

  // Upload image to Firebase Storage
  let imageURL = null
  if (image.value) {
    const storage = getStorage()
    const fileName = `${userId.value}_${Date.now()}_${image.value.name}`
    const imgRef = storageRef(storage, `mealImages/${fileName}`)
    await uploadBytes(imgRef, image.value)
    imageURL = await getDownloadURL(imgRef)
  }

  for (const food of foods) {
    for (const key in food) {
      if (key !== 'name') {
        dailyNutrients[key] = (dailyNutrients[key] || 0) + (food[key] || 0)
        if (limits[key] && dailyNutrients[key] > limits[key]) {
          alerts.value.push(`${key} is too high! Possible risk of ${getDiagnosis(key)}.`)
        }
      }
    }



  }
  mealHistory.value.push({
    name: foods.map(f => f.name).join(', '),
    image: imageURL,
    foods: foods, // Full food objects
    nutrients: { ...dailyNutrients } // Store a copy
  })

  syncDisplayNutrients()
  updateWeeklyData()

  await addDoc(collection(db, 'meals'), {
    userId: userId.value,
    date: new Date().toLocaleDateString('en-CA'), // Format: YYYY-MM-DD
    week: getWeekNumber(new Date()),              // ✅ Add this
    foods: foods.map(f => f.name),
    image: imageURL,
    nutrients: { ...dailyNutrients }
  })


}


function syncDisplayNutrients() {
  displayNutrients.Carbs = Math.round((dailyNutrients.Carbs || 0) / 300 * 100)
  displayNutrients.Protein = Math.round((dailyNutrients.Protein || 0) / 150 * 100)
  displayNutrients.Fat = Math.round((dailyNutrients.Fat || 0) / 70 * 100)
}

function getDiagnosis(nutrient) {
  const risks = {
    Sugar: 'insulin resistance or type 2 diabetes',
    Fat: 'cardiovascular disease',
    Sodium: 'high blood pressure',
    VitaminC: 'diarrhea or stomach cramps',
    VitaminD: 'kidney stones or toxicity'
  }
  return risks[nutrient] || 'nutrient overload'
}

async function loadWeeklyData() {
  if (!userId.value) return

  const currentWeek = getWeekNumber(new Date())

  const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId.value),
      where('week', '==', currentWeek)
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) return

  // Reset before aggregating
  resetWeeklyData()

  snapshot.forEach(docSnap => {
    const data = docSnap.data()
    const [year, month, day] = data.date.split('-')
    const localDate = new Date(+year, +month - 1, +day)
    const dayStr = localDate.toLocaleDateString('en-US', { weekday: 'short' })


    const entry = weeklyData.find(d => d.day === dayStr)
    const n = data.nutrients || {}
    if (entry) {
      entry.Carbs += Math.round((n.Carbs || 0) / 300 * 100)
      entry.Protein += Math.round((n.Protein || 0) / 150 * 100)
      entry.Fat += Math.round((n.Fat || 0) / 70 * 100)
    }
  })

  weeklyData.forEach(day => {
    day.Percent = Math.round((day.Carbs + day.Protein + day.Fat) / 3)
  })
}
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userId.value = user.uid
      checkForReset()
      loadTodayMeal()
      loadWeeklyData() // ✅ Also load weekly stats
    } else {
      console.log('User not logged in')
    }
  })
})


function resetDailyData() {
  for (const key in dailyNutrients) {
    dailyNutrients[key] = 0
  }
  syncDisplayNutrients()
  mealHistory.value = []
  alerts.value = []
}

function resetWeeklyData() {
  weeklyData.forEach(day => {
    day.Carbs = 0
    day.Protein = 0
    day.Fat = 0
    day.Percent = 0
  })
}
// DELETE this whole function ↓
function updateWeeklyData() {
  const today = new Date().getDay()
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = dayMap[today]
  const entry = weeklyData.find(d => d.day === day)
  if (entry) {
    entry.Carbs = displayNutrients.Carbs
    entry.Protein = displayNutrients.Protein
    entry.Fat = displayNutrients.Fat
    entry.Percent = Math.round((entry.Carbs + entry.Protein + entry.Fat) / 3)
  }
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function checkForReset() {
  const todayStr = new Date().toLocaleDateString('en-CA')

  const today = new Date()
  const currentWeek = getWeekNumber(today)
  const lastReset = localStorage.getItem('lastResetDate')
  const lastWeek = localStorage.getItem('lastWeeklyReset')

  if (lastReset !== todayStr) {
    resetDailyData()
    localStorage.setItem('lastResetDate', todayStr) // ✅ update here
  }

  if (lastWeek !== String(currentWeek)) {
    resetWeeklyData()
    localStorage.setItem('lastWeeklyReset', String(currentWeek)) // ✅ update here
  }
}

async function loadTodayMeal() {
  if (!userId.value) return
  const todayStr = new Date().toLocaleDateString('en-CA')

  const q = query(
      collection(db, 'meals'),
      where('userId', '==', userId.value),
      where('date', '==', todayStr)
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) return

  resetDailyData()

  snapshot.forEach(docSnap => {
    const data = docSnap.data()
    const nutrients = data.nutrients || {}
    const foods = data.foods || []

    for (const [key, value] of Object.entries(nutrients)) {
      dailyNutrients[key] = (dailyNutrients[key] || 0) + value
    }

    mealHistory.value.push({
      name: foods.join(', '),
      image: data.image || null,
      nutrients: data.nutrients || {},
      foods: foods.map(name => ({ name })) // fallback if you didn't save full objects
    })

  })

  syncDisplayNutrients()
  updateWeeklyData()
}



onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userId.value = user.uid
      checkForReset()
      loadTodayMeal()
    } else {
      console.log('User not logged in')
    }
  })
})

</script>

<style>
body {
  font-family: 'Inter', sans-serif;
  background-color: #f9fafb;
}
.dark body {
  background-color: #1f2937;
}
</style>

