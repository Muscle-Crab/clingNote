<template>
  <div class="p-4 max-w-md mx-auto">
    <h2 class="text-2xl font-bold mb-6 text-center">📝 Voice Task List</h2>

    <transition-group name="fade" tag="ul" class="mb-6 space-y-2">
      <li
          v-for="(task, index) in tasks"
          :key="task + index"
          class="bg-white border p-3 rounded-full flex items-center gap-2 shadow"
      >
        <span class="text-green-500">✔</span>
        {{ task }}
      </li>
    </transition-group>

    <div class="flex justify-center relative">
      <button
          :class="['bg-blue-500 text-white p-5 rounded-full text-3xl shadow-lg transition duration-300', isListening ? 'animate-pulse' : '']"
          @mousedown="startListening"
          @mouseup="stopListening"
          @touchstart.prevent="startListening"
          @touchend.prevent="stopListening"
      >
        🎤
      </button>
    </div>

    <div v-if="isListening" class="mt-4 text-center">
      <div class="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
        <div class="h-full bg-blue-500 animate-pulse w-1/3 rounded-full"></div>
      </div>
      <p class="text-sm text-blue-600 mt-2 font-medium">Listening...</p>
    </div>

    <div
        v-if="pendingTranscript"
        class="mt-6 p-4 rounded-xl border border-yellow-300 bg-yellow-50 shadow"
    >
      <p class="font-medium text-yellow-800">🕒 Pending task:</p>
      <p class="italic my-2 text-gray-700">"{{ pendingTranscript }}"</p>
      <p class="text-sm text-gray-500">Adding in 5 seconds...</p>
      <button
          @click="cancelPending"
          class="mt-3 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Cancel
      </button>
    </div>

    <p class="mt-6 text-gray-400 text-center text-sm">Hold the mic and speak your task</p>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue'

const tasks = ref([])
const recognition = ref(null)
const isListening = ref(false)
const pendingTranscript = ref('')
const addTimeout = ref(null)

onMounted(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.")
    return
  }

  recognition.value = new SpeechRecognition()
  recognition.value.continuous = false
  recognition.value.lang = 'en-US'
  recognition.value.interimResults = false

  recognition.value.onstart = () => {
    isListening.value = true
  }

  recognition.value.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    pendingTranscript.value = transcript

    // Start a 5-second timer before adding the task
    addTimeout.value = setTimeout(() => {
      tasks.value.push(pendingTranscript.value)
      pendingTranscript.value = ''
    }, 5000)
  }

  recognition.value.onspeechend = () => {
    recognition.value.stop()
  }

  recognition.value.onend = () => {
    isListening.value = false
  }

  recognition.value.onerror = (event) => {
    console.error('Speech error:', event)
    isListening.value = false
  }
})

const startListening = () => {
  if (recognition.value && !isListening.value) {
    pendingTranscript.value = ''
    recognition.value.start()
  }
}

const stopListening = () => {
  if (recognition.value && isListening.value) {
    recognition.value.stop()
  }
}

const cancelPending = () => {
  if (addTimeout.value) {
    clearTimeout(addTimeout.value)
    addTimeout.value = null
  }
  pendingTranscript.value = ''
}
</script>

<style>
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f9fafb;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
