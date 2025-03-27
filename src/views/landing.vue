<template>
  <div class="p-4">
    <h2 class="text-xl font-bold mb-4">Task List</h2>

    <ul class="mb-4">
      <li v-for="(task, index) in tasks" :key="index" class="mb-2 bg-gray-100 p-2 rounded">
        {{ task }}
      </li>
    </ul>

    <button
        class="bg-blue-500 text-white p-4 rounded-full text-2xl shadow-lg"
        @mousedown="startListening"
        @mouseup="stopListening"
        @touchstart.prevent="startListening"
        @touchend.prevent="stopListening"
    >
      +
    </button>

    <div v-if="isListening" class="mt-2 text-blue-600 font-medium">🎤 Listening...</div>

    <div v-if="pendingTranscript" class="mt-4 p-4 bg-yellow-100 rounded">
      <p><strong>Pending:</strong> "{{ pendingTranscript }}"</p>
      <p class="text-sm text-gray-500">Adding in 5 seconds...</p>
      <button
          @click="cancelPending"
          class="mt-2 bg-red-500 text-white px-3 py-1 rounded"
      >
        Cancel
      </button>
    </div>

    <p class="mt-4 text-gray-500">Hold the button and speak your task</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

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
  font-family: sans-serif;
}
</style>
