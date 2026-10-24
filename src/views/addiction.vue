<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto bg-white/70 backdrop-blur-md shadow-2xl rounded-2xl p-8 transition-all duration-300">
      <h1 class="text-4xl font-extrabold text-center text-indigo-800 mb-4 tracking-tight">🌱 Recovery Tracker</h1>
      <!-- Not medical advice (always visible) -->
      <div class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="note" data-test="recovery-disclaimer">
        <p class="font-semibold mb-1">This is a self-tracking tool, not medical advice.</p>
        <p class="mb-1">ClingNote does not diagnose, treat or cure any condition, and it is not a substitute for professional help. If you are struggling with addiction or your mental health, please talk to a doctor or a qualified counsellor.</p>
        <p>
          In the U.S. you can call or text <a href="tel:988" class="underline font-medium">988</a> (Suicide &amp; Crisis Lifeline) or call the SAMHSA Helpline at
          <a href="tel:18006624357" class="underline font-medium">1-800-662-4357</a> (free, confidential, 24/7). Outside the U.S., contact your local emergency number or health service.
          In an emergency, call your local emergency number.
        </p>
      </div>
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
      <!-- Habit -->
      <div class="mb-6" v-if="!addictionLocked">
        <label class="block text-gray-700 font-medium mb-2" for="rc-habit">What are you quitting?</label>
        <select id="rc-habit" v-model="addictionType" class="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400" data-test="rc-habit">
          <option value="Masturbation">Masturbation (NoFap)</option>
          <option value="Porn">Adult content</option>
          <option>Smoking</option>
          <option>Sugar</option>
          <option>Social Media</option>
          <option>Gaming</option>
          <option value="__other">Something else…</option>
        </select>
        <input v-if="addictionType === '__other'" v-model.trim="customHabit" maxlength="40" placeholder="Name your habit" class="mt-2 w-full p-3 border border-gray-300 rounded-xl" data-test="rc-custom" />
        <button type="button" class="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold" data-test="rc-habit-save" @click="lockAddiction">Start tracking</button>
      </div>
      <div v-else class="mb-6">
        <label class="block text-gray-700 font-medium mb-2">Habit tracked:</label>
        <div class="p-3 bg-indigo-100 rounded-xl text-indigo-700 font-semibold shadow-inner flex justify-between items-center">
          <span data-test="rc-habit-label">{{ addictionLabel }}</span>
          <button type="button" class="text-xs underline text-indigo-500" @click="addictionLocked = false">Change</button>
        </div>
        <p class="text-xs text-gray-500 mt-1">🔒 Private: only you can see this. It is never shared with pals or managers.</p>
      </div>

      <!-- Your why -->
      <div class="mb-6 bg-white/60 rounded-2xl p-4 border border-indigo-100">
        <label class="block text-gray-700 font-semibold mb-2" for="rc-why">💡 My why</label>
        <textarea id="rc-why" v-model="why" rows="2" maxlength="300" placeholder="Why are you doing this? e.g. more energy, focus, self-respect" class="w-full p-3 border border-gray-300 rounded-xl text-sm" data-test="rc-why" @change="saveFields({ why })"></textarea>
        <label class="block text-gray-700 font-semibold mt-3 mb-2" for="rc-plan">🛡️ My plan for high-risk times</label>
        <textarea id="rc-plan" v-model="plan" rows="2" maxlength="300" placeholder="If … (e.g. I'm alone with my phone after 11 pm), then I will … (put it in the kitchen and read)" class="w-full p-3 border border-gray-300 rounded-xl text-sm" data-test="rc-plan" @change="saveFields({ plan })"></textarea>
      </div>

      <!-- Motivational Quote -->
      <div class="mb-6 bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg text-indigo-800 font-medium text-center text-sm shadow-sm">
        <strong>Quote of the Day:</strong> "{{ dailyQuote }}"
      </div>

      <!-- This week -->
      <div class="mb-8 flex justify-between items-center px-4 py-3 bg-gradient-to-r from-indigo-100 to-indigo-200 rounded-xl shadow-sm">
        <div v-for="(day, index) in daysOfWeek" :key="day" class="text-center flex-1">
          <div :class="['text-sm font-semibold', currentDayIndex === index ? 'text-indigo-800' : 'text-gray-400']">{{ day.slice(0, 3) }}</div>
          <div class="text-2xl mt-1"><span>{{ getEmojiForDay(index) }}</span></div>
        </div>
      </div>

      <!-- Daily check-in (today or a recent day) -->
      <div class="mb-6 bg-white/60 rounded-2xl p-4 border border-indigo-100" data-test="rc-checkin">
        <label class="block text-lg font-semibold text-gray-700 mb-2" for="rc-date">How was this day?</label>
        <select id="rc-date" v-model="markDate" class="w-full p-2 mb-3 border border-gray-300 rounded-xl text-sm" data-test="rc-date">
          <option v-for="d in recentDates" :key="d" :value="d">{{ dateLabel(d) }}{{ days[d] ? ' · ' + (days[d].s === 'clean' ? '✅ clean' : '🚫 dirty') : ' · not marked' }}</option>
        </select>
        <div class="flex gap-4">
          <button type="button" @click="markDay('clean')" :class="['flex-1 px-6 py-3 text-white font-bold rounded-xl shadow', days[markDate]?.s === 'clean' ? 'bg-green-700 ring-4 ring-green-200' : 'bg-green-500 hover:bg-green-600']" data-test="rc-clean">✅ Clean</button>
          <button type="button" @click="markDay('dirty')" :class="['flex-1 px-6 py-3 text-white font-bold rounded-xl shadow', days[markDate]?.s === 'dirty' ? 'bg-red-700 ring-4 ring-red-200' : 'bg-red-500 hover:bg-red-600']" data-test="rc-dirty">🚫 Dirty</button>
        </div>
        <div v-if="days[markDate]?.s === 'dirty'" class="mt-4" data-test="rc-relapse">
          <p class="text-sm text-indigo-800 bg-indigo-50 rounded-lg p-3 mb-3">{{ RELAPSE_MESSAGE }}</p>
          <p class="text-sm font-semibold text-gray-700 mb-2">What triggered it? (optional)</p>
          <div class="flex flex-wrap gap-2 mb-3">
            <button v-for="t in TRIGGERS" :key="t" type="button" :class="['px-3 py-1 rounded-full text-sm border', (days[markDate].triggers || []).includes(t) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300']" data-test="rc-trigger" @click="toggleTrigger(t)">{{ t }}</button>
          </div>
          <textarea v-model="noteDraft" rows="2" maxlength="300" placeholder="Reflection (optional): what would you do differently next time?" class="w-full p-3 border border-gray-300 rounded-xl text-sm" data-test="rc-note" @change="saveNote"></textarea>
        </div>
        <p v-if="saveError" class="text-sm text-red-600 mt-2" role="alert" data-test="rc-error">{{ saveError }}</p>
      </div>

      <!-- Urge help -->
      <div class="mb-6 bg-white/60 rounded-2xl p-4 border border-indigo-100" data-test="rc-urge">
        <button type="button" class="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow" data-test="rc-urge-btn" @click="startUrge">🌊 I have an urge</button>
        <div v-if="urgeTip" class="mt-4 text-center">
          <p class="font-semibold text-indigo-800">{{ urgeTip.t }}</p>
          <p class="text-sm text-gray-700 mt-1">{{ urgeTip.d }}</p>
          <p v-if="why" class="text-sm text-gray-600 mt-2 italic">Your why: “{{ why }}”</p>
          <div v-if="urgeLeft > 0" class="mt-4">
            <div class="rc-breath mx-auto" aria-hidden="true"></div>
            <p class="text-sm text-gray-600 mt-2">Breathe in 4 · hold 4 · out 6. The urge will pass.</p>
            <p class="text-2xl font-bold text-indigo-700 mt-1" data-test="rc-urge-timer">{{ mmss(urgeLeft) }}</p>
          </div>
          <p v-else class="text-sm text-green-700 mt-3 font-semibold">You rode it out. 💪</p>
          <button type="button" class="mt-2 text-xs underline text-indigo-500" @click="urgeTip = randomTip()">Another tip</button>
        </div>
      </div>

      <!-- Free Day Selection -->
      <div class="mb-6">
        <label class="block text-md font-semibold text-gray-700 mb-2">Allowed free day (won't affect streak):</label>
        <select v-model="allowedRelapseDay" class="w-full p-3 border border-gray-300 rounded-xl focus:ring focus:ring-indigo-300" @change="saveFields({ allowedRelapseDay })">
          <option value="">No free day</option>
          <option v-for="day in daysOfWeek" :key="day" :value="day">{{ day }}</option>
        </select>
        <p v-if="allowedRelapseDay" class="text-xs text-gray-500 mt-1">Next free day in <strong>{{ nextFreeDayCountdown }}</strong> day(s)</p>
      </div>

      <!-- Progress Tracking -->
      <div class="mb-6 bg-white/60 rounded-2xl shadow-lg p-5 transition-all duration-300 border border-indigo-100">
        <h2 class="text-2xl font-extrabold text-indigo-700 mb-4 flex items-center gap-2">📈 Your Progress</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div class="bg-indigo-50 rounded-xl p-4 shadow-sm"><p class="text-sm text-gray-500 mb-1">Current Streak</p><p class="text-2xl font-bold text-indigo-700" data-test="rc-streak">{{ st.current }}🔥</p></div>
          <div class="bg-indigo-50 rounded-xl p-4 shadow-sm"><p class="text-sm text-gray-500 mb-1">Best Streak</p><p class="text-2xl font-bold text-indigo-700" data-test="rc-best">{{ st.best }}🏆</p></div>
          <div class="bg-green-50 rounded-xl p-4 shadow-sm"><p class="text-sm text-gray-500 mb-1">Clean Days</p><p class="text-2xl font-semibold text-green-600" data-test="rc-clean-total">{{ st.clean }} ✅</p></div>
          <div class="bg-red-50 rounded-xl p-4 shadow-sm"><p class="text-sm text-gray-500 mb-1">Dirty Days</p><p class="text-2xl font-semibold text-red-500" data-test="rc-dirty-total">{{ st.dirty }} 🚫</p></div>
        </div>
        <div class="mt-6">
          <p class="text-sm text-gray-600 font-medium mb-2">Streak Progress</p>
          <div class="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner"><div class="h-full bg-indigo-500 transition-all duration-500" :style="{ width: streakProgress + '%' }"></div></div>
          <p class="text-xs text-right text-gray-500 mt-1">{{ Math.round(streakProgress) }}% toward 30-day goal</p>
        </div>

        <!-- Month grid -->
        <div class="mt-6" data-test="rc-month">
          <div class="flex justify-between items-center mb-2">
            <button type="button" class="px-3 py-1 rounded-lg bg-indigo-50" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
            <strong class="text-indigo-800">{{ monthLabel }}</strong>
            <button type="button" class="px-3 py-1 rounded-lg bg-indigo-50" aria-label="Next month" :disabled="isCurrentMonth" @click="shiftMonth(1)">›</button>
          </div>
          <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1"><span v-for="d in daysOfWeek" :key="d">{{ d.slice(0, 2) }}</span></div>
          <div v-for="(w, wi) in grid" :key="wi" class="grid grid-cols-7 gap-1 mb-1">
            <span v-for="c in w" :key="c.date" :class="['rc-cell', c.inMonth ? '' : 'opacity-30', c.status === 'clean' ? 'rc-clean' : c.status === 'dirty' ? 'rc-dirty' : '', c.date === today ? 'rc-today' : '']" :title="c.date + (c.status ? ' · ' + c.status : '')" :data-status="c.status">{{ c.day }}</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Green = clean, red = dirty, grey = not marked (counts neither way).</p>
        </div>
      </div>

      <!-- Tricks to quit -->
      <div class="mb-6 bg-white/60 rounded-2xl p-5 border border-indigo-100" data-test="rc-tips">
        <h2 class="text-xl font-extrabold text-indigo-700 mb-3">🧰 Tricks to quit</h2>
        <ul class="space-y-2">
          <li v-for="tip in TIPS" :key="tip.t" class="text-sm"><strong class="text-gray-800">{{ tip.t }}.</strong> <span class="text-gray-600">{{ tip.d }}</span></li>
        </ul>
        <p class="text-xs text-gray-500 mt-3">Based on habit-change research (urge surfing / mindfulness, CBT and ACT, if-then plans, trigger awareness). If it feels out of control, a therapist trained in CBT or ACT can help.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { auth, db } from '@/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore'
import { localDate, addDays, dayIndexOf, normalizeDays, stats, canMark, monthGrid, fuelFor, TIPS, TRIGGERS, RELAPSE_MESSAGE, randomTip, BACKFILL_DAYS } from '@/utils/recovery'

const PRESETS = ['Masturbation', 'Porn', 'Smoking', 'Sugar', 'Social Media', 'Gaming']
const addictionType = ref('Masturbation')
const customHabit = ref('')
const addictionLocked = ref(false)
// 'Porn' is the value already stored in existing accounts; it is shown to people as "Adult content".
const addictionLabel = computed(() => { const v = String(addictionType.value); return v.toLowerCase() === 'porn' ? 'Adult content' : v === 'Masturbation' ? 'Masturbation (NoFap)' : v })
const days = ref({}) // { 'YYYY-MM-DD': { s: 'clean'|'dirty', triggers?: [], note?: '' } }
const allowedRelapseDay = ref('')
const why = ref('')
const plan = ref('')
const goal = 30
const userId = ref(null)
const saveError = ref('')
const today = ref(localDate())
const markDate = ref(today.value)
const noteDraft = ref('')
watch(markDate, (d) => { noteDraft.value = days.value[d]?.note || '' })

const quotes = ['Progress, not perfection.', 'One day at a time.', 'You’re stronger than your urges.', 'Discipline is freedom.', 'Every day is a fresh start.', 'A slip is a lesson, not a verdict.']
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const currentDayIndex = computed(() => dayIndexOf(today.value))
const st = computed(() => stats(days.value, today.value, allowedRelapseDay.value))
const fuel = computed(() => fuelFor(days.value, today.value, allowedRelapseDay.value))
const streakProgress = computed(() => Math.min(100, (st.value.current / goal) * 100))
const dailyQuote = computed(() => quotes[Number(today.value.slice(8)) % quotes.length])
const recentDates = computed(() => Array.from({ length: BACKFILL_DAYS }, (_, i) => addDays(today.value, -i)))
const dateLabel = (d) => (d === today.value ? 'Today' : d === addDays(today.value, -1) ? 'Yesterday' : `${daysOfWeek[dayIndexOf(d)]} ${Number(d.slice(5, 7))}/${Number(d.slice(8))}`)
const nextFreeDayCountdown = computed(() => (daysOfWeek.indexOf(allowedRelapseDay.value) - currentDayIndex.value + 7) % 7 || 7)

function getEmojiForDay(index) {
  const m = days.value[addDays(today.value, index - currentDayIndex.value)]
  return m ? (m.s === 'dirty' ? '🚫' : '✅') : ''
}

// month grid
const monthOffset = ref(0)
const monthBase = computed(() => { const [y, m] = today.value.split('-').map(Number); const d = new Date(y, m - 1 + monthOffset.value, 1, 12); return { y: d.getFullYear(), m: d.getMonth() } })
const grid = computed(() => monthGrid(monthBase.value.y, monthBase.value.m, days.value, today.value))
const monthLabel = computed(() => new Date(monthBase.value.y, monthBase.value.m, 1, 12).toLocaleString(undefined, { month: 'long', year: 'numeric' }))
const isCurrentMonth = computed(() => monthOffset.value >= 0)
const shiftMonth = (n) => { monthOffset.value = Math.min(0, monthOffset.value + n) }

const trackerRef = () => doc(db, 'users', userId.value, 'nofap', 'tracker')
async function save(patch) {
  if (!userId.value) { saveError.value = 'Sign in to save your progress.'; return false }
  try { await setDoc(trackerRef(), { ...patch, updatedAt: Date.now() }, { merge: true }); saveError.value = ''; return true }
  catch (e) { console.error('recovery save failed', e); saveError.value = "Couldn't save. Check your connection and try again."; return false }
}
const saveFields = (patch) => save(patch)

function speak(text) { try { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)) } catch (_) { /* no speech */ } }

async function markDay(status) {
  const d = markDate.value
  if (!canMark(d, today.value)) return
  const prev = days.value[d]
  const mark = status === 'dirty' ? { s: 'dirty', triggers: prev?.s === 'dirty' ? prev.triggers || [] : [], note: prev?.s === 'dirty' ? prev.note || '' : '' } : { s: 'clean' }
  days.value = { ...days.value, [d]: mark }
  noteDraft.value = mark.note || ''
  // merge deep-merges maps: clear stale triggers/note explicitly when a day becomes clean
  const ok = await save({ days: { [d]: status === 'clean' ? { s: 'clean', triggers: deleteField(), note: deleteField() } : mark } })
  if (!ok) { const next = { ...days.value }; if (prev) next[d] = prev; else delete next[d]; days.value = next; return }
  if (prev?.s !== status) speak(status === 'clean' ? "Nice work. Another clean day." : RELAPSE_MESSAGE)
}
async function toggleTrigger(t) {
  const d = markDate.value; const m = days.value[d]; if (!m || m.s !== 'dirty') return
  const triggers = (m.triggers || []).includes(t) ? m.triggers.filter((x) => x !== t) : [...(m.triggers || []), t]
  days.value = { ...days.value, [d]: { ...m, triggers } }
  await save({ days: { [d]: days.value[d] } })
}
async function saveNote() {
  const d = markDate.value; const m = days.value[d]; if (!m || m.s !== 'dirty') return
  days.value = { ...days.value, [d]: { ...m, note: noteDraft.value.slice(0, 300) } }
  await save({ days: { [d]: days.value[d] } })
}

async function lockAddiction() {
  const v = addictionType.value === '__other' ? customHabit.value.trim() : addictionType.value
  if (!v) return
  addictionType.value = v; addictionLocked.value = true
  await save({ addictionType: v })
}

// urge helper: random tip + 10-minute urge-surfing timer
const urgeTip = ref(null); const urgeLeft = ref(0); let urgeTimer = null
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
function startUrge() {
  urgeTip.value = randomTip(); urgeLeft.value = 600; clearInterval(urgeTimer)
  const end = Date.now() + 600000
  urgeTimer = setInterval(() => { urgeLeft.value = Math.max(0, Math.round((end - Date.now()) / 1000)); if (!urgeLeft.value) clearInterval(urgeTimer) }, 1000)
}

// keep "today" right across midnight while the page stays open
const dayTick = setInterval(() => { const t = localDate(); if (t !== today.value) { if (markDate.value === today.value) markDate.value = t; today.value = t } }, 60000)
let unsub = null
onBeforeUnmount(() => { clearInterval(urgeTimer); clearInterval(dayTick); if (unsub) unsub() })

onMounted(() => {
  unsub = onAuthStateChanged(auth, async (user) => {
    if (!user) { userId.value = null; return }
    userId.value = user.uid
    try {
      const snap = await getDoc(trackerRef())
      if (!snap.exists()) return // nothing saved yet; the first check-in creates the doc (setDoc merge)
      const data = snap.data()
      if (data.addictionType) { addictionType.value = data.addictionType; addictionLocked.value = true; if (!PRESETS.includes(data.addictionType)) customHabit.value = data.addictionType }
      days.value = normalizeDays(data)
      allowedRelapseDay.value = data.allowedRelapseDay ?? ''
      why.value = data.why || ''; plan.value = data.plan || ''
      noteDraft.value = days.value[markDate.value]?.note || ''
      // one-time migration of the old arrays into the per-date map
      if ((data.retentionDays || data.relapseDays) && !data.days) await save({ days: days.value, retentionDays: deleteField(), relapseDays: deleteField(), streak: deleteField(), fuel: deleteField() })
    } catch (e) { console.error('recovery load failed', e); saveError.value = "Couldn't load your tracker. Check your connection." }
  })
})
</script>


<style scoped>
.rc-cell { display: flex; align-items: center; justify-content: center; height: 2rem; border-radius: 6px; font-size: .75rem; background: #e5e7eb; color: #6b7280; }
.rc-clean { background: #22c55e; color: #fff; }
.rc-dirty { background: #ef4444; color: #fff; }
.rc-today { outline: 2px solid #4f46e5; outline-offset: 1px; }
.rc-breath { width: 64px; height: 64px; border-radius: 50%; background: #c7d2fe; animation: rc-breathe 14s ease-in-out infinite; }
@keyframes rc-breathe { 0% { transform: scale(.6); } 28% { transform: scale(1); } 57% { transform: scale(1); } 100% { transform: scale(.6); } }
@media (prefers-reduced-motion: reduce) { .rc-breath { animation: none; } }
</style>
