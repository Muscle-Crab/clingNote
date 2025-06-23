<template>
  <div class="pt-16 px-4 sm:px-6 w-full text-gray-100 bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen font-sans space-y-6">
    <div >

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between text-center sm:text-left space-y-2 sm:space-y-0">
        <h1 class="text-xl sm:text-3xl font-bold tracking-tight">
          📊 Track Daily Nutrients
        </h1>
        <div class="text-sm sm:text-base font-medium text-blue-400">
          🔋 Credits Remaining: <span class="font-semibold text-blue-300">{{ credits }}</span>
        </div>
      </div>


      <!-- Loading Overlay -->
      <div v-if="isLoading" class="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4">
        <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-base font-medium text-white animate-pulse">Analyzing image...</p>
      </div>

      <!-- Upload Section -->
      <div class="bg-gray-800/70 backdrop-blur rounded-lg p-4 shadow text-white space-y-3">
        <div class="text-center">
          <h2 class="text-base font-semibold">📤 Upload Your Meal</h2>
          <p class="text-xs text-gray-400">Tap or drag an image of your meal</p>
        </div>

        <label class="flex flex-col items-center justify-center border-2 border-dashed border-blue-500/40 hover:border-blue-400 transition rounded-lg p-4 cursor-pointer bg-gray-900/40">
          <input type="file" @change="onImageUpload" accept="image/*" class="hidden" />
          <div v-if="previewImageURL" class="w-28 h-28 rounded-md overflow-hidden border border-gray-700 shadow mb-2">
            <img :src="previewImageURL" class="w-full h-full object-cover" />
          </div>
          <div v-else class="flex flex-col items-center gap-1 text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 15a4 4 0 104 4H5a2 2 0 01-2-2v-2a2 2 0 012-2h2a4 4 0 00-4-4m9-4l3 3m0 0l-3 3m3-3H4" />
            </svg>
            <span class="text-xs font-medium">Click to upload</span>
          </div>
        </label>

        <button
            @click="handleAnalyzeClick"
            :disabled="!image || isLoading"
            :class="[
    'w-full py-2 rounded-md text-white font-medium text-sm transition',
    (!image || isLoading)
      ? 'bg-gray-600 cursor-not-allowed'
      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90'
  ]"
            :title="credits <= 0 ? 'No credits left. Click to buy more.' : ''"
        >
          🔍 Analyze
        </button>


      </div>

      <!-- Health Alerts -->
      <div v-if="alerts.length" class="bg-red-900/30 border border-red-600 text-red-400 p-3 rounded-lg text-sm shadow-inner space-y-2">
        <h3 class="font-bold text-red-300">⚠️ Alerts</h3>
        <ul class="list-disc list-inside">
          <li v-for="(alert, index) in alerts" :key="index">{{ alert }}</li>
        </ul>
      </div>

      <!-- Daily Nutrients -->
      <div class="bg-gray-800/80 backdrop-blur p-4 rounded-lg shadow space-y-3">
        <h2 class="text-base font-semibold">🚨 Daily Nutrients</h2>
        <div v-for="(value, key) in displayNutrients" :key="key" class="space-y-1">
          <div class="flex justify-between text-xs">
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
                class="h-2"
                :style="{ width: value + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Meal History -->
      <div class="bg-gray-800/80 backdrop-blur p-4 rounded-lg shadow space-y-2">
        <h2 class="text-base font-semibold mb-1">🍽 Meal History</h2>
        <div class="space-y-2">
          <div
              v-for="(item, idx) in mealHistory"
              :key="idx"
              @click="selectedMeal = item"
              class="flex items-center gap-3 p-2 rounded-md border border-gray-700 bg-gray-900/40 hover:bg-gray-800 transition cursor-pointer"
          >
            <img v-if="item.image" :src="item.image" class="w-12 h-12 object-cover rounded shadow" />
            <div class="flex-1 min-w-0">
              <span class="block text-sm font-medium truncate text-gray-300">{{ item.name }}</span>
              <span class="text-xs text-gray-400">Tap to view</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Meal Details Modal -->
      <div
          v-if="selectedMeal"
          class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-3 py-6"
          @click.self="selectedMeal = null"
      >
        <div class="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-lg border border-white/10 text-white rounded-2xl p-5 w-full max-w-md max-h-full overflow-y-auto shadow-2xl space-y-5">
          <div class="flex justify-between items-center border-b border-white/10 pb-2">
            <h3 class="text-lg font-semibold tracking-tight">🍱 Meal Details</h3>
            <button @click="selectedMeal = null" class="text-white/60 hover:text-white text-2xl">&times;</button>
          </div>

          <img v-if="selectedMeal.image" :src="selectedMeal.image" class="w-full h-40 object-cover rounded-lg border border-white/10 shadow" />

          <div>
            <p class="text-sm text-white/70 font-medium mb-1">Foods:</p>
            <ul class="list-disc list-inside text-sm text-white/90 space-y-1">
              <li v-for="(food, i) in selectedMeal.foods" :key="i">{{ food.name }}</li>
            </ul>
          </div>

          <div>
            <p class="text-sm text-white/70 font-medium mb-1">Nutrients:</p>
            <div class="flex flex-wrap gap-2">
            <span
                v-for="(val, key) in selectedMeal.nutrients"
                :key="key"
                class="bg-blue-600/80 hover:bg-blue-500/90 text-white text-xs font-medium px-2 py-1 rounded-full shadow-sm"
            >
              {{ key }}: {{ formatNutrient(val, key) }}
            </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>




<script setup>
import { ref, reactive, onMounted } from 'vue'
import { db, auth} from '@/firebaseConfig.js'
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc} from 'firebase/firestore'
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
  if (credits.value <= 0) {
    await redirectToCheckout();
    return;
  }

  isLoading.value = true;
  try {
    const base64 = await toBase64(image.value);
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
                  text: `You are analyzing a product image like a smoothie or drink. If it shows a visible nutrition label, extract the values **exactly as shown**. Return the full nutrient data per container (not per 100g).

Return JSON like:
{
  "foods": ["Bolthouse Farms Blue Goodness Smoothie"],
  "nutrients": {
    "Calories": 260,
    "Carbs": 62,
    "Protein": 1,
    "Fat": 0,
    "Sugar": 52,
    "Sodium": 30,
    "Fiber": 3,
    "VitaminC": 140,
    "VitaminD": 0
  }
}

If no label is visible, do your best to estimate. Do not explain anything. Output only JSON.`
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
    );

    let content = res.data.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/```(?:json)?/g, '').trim();
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse JSON:', content);
      alerts.value.push('GPT returned invalid JSON. Try uploading a clearer or simpler meal image.');
      return;
    }

    // Upload image to Firebase Storage
    let imageURL = null;
    if (image.value) {
      const storage = getStorage();
      const fileName = `${userId.value}_${Date.now()}_${image.value.name}`;
      const imgRef = storageRef(storage, `mealImages/${fileName}`);
      await uploadBytes(imgRef, image.value);
      imageURL = await getDownloadURL(imgRef);
    }

    // Save nutrient data
    const enrichedFood = { ...result.nutrients, name: result.foods.join(', ') };
    await processNutrients([enrichedFood], imageURL);

    // Store in meal history
    mealHistory.value.push({
      name: result.foods.join(', '),
      nutrients: result.nutrients,
      foods: result.foods.map(name => ({ name })),
      image: imageURL
    });

    // ✅ Deduct 1 credit
    const userRef = doc(db, 'users', userId.value);
    await updateDoc(userRef, {
      credits: credits.value - 1
    });
    credits.value -= 1;

    if (alerts.value.length) speakAlerts();

  } catch (err) {
    console.error('Image analysis failed:', err);

  } finally {
    isLoading.value = false;
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

async function processNutrients(foods, imageURL = null) {
  alerts.value = []

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

  syncDisplayNutrients()
  updateWeeklyData()

  await addDoc(collection(db, 'meals'), {
    userId: userId.value,
    date: new Date().toLocaleDateString('en-CA'),
    week: getWeekNumber(new Date()),
    foods: foods.map(f => f.name),
    image: imageURL,
    nutrients: { ...dailyNutrients }
  })

  if (alerts.value.length) speakAlerts()
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
const credits = ref(0)


onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId.value = user.uid
    checkForReset()
    loadTodayMeal()
    loadWeeklyData()
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (userDoc.exists()) {
      credits.value = userDoc.data().credits || 0
    }
  } else {
    console.log('User not logged in')
  }
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
function speakAlerts() {
  if (!alerts.value.length) return;

  // ✅ Stop any ongoing speech before starting a new one
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const message = `Warning. ${alerts.value.join('. ')}`;
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}
const handleAnalyzeClick = async () => {
  if (credits.value <= 0) {
    await redirectToCheckout();
    return;
  }
  await analyzeImage();
};



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

