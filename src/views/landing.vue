<template>
  <div class="p-4 max-w-md mx-auto">
    <h1 class="text-xl font-bold mb-4">Voice Task Creator</h1>

    <button
        @click="startListening"
        class="bg-blue-500 text-white px-4 py-2 rounded mb-4"
    >
      🎙️ Start Voice Input
    </button>

    <p v-if="listening" class="text-green-600 mb-2">Listening...</p>
    <p v-if="error" class="text-red-600 mb-2">{{ error }}</p>

    <ul>
      <li
          v-for="(task, index) in tasks"
          :key="index"
          class="bg-gray-100 rounded p-2 my-2"
      >
        {{ task }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const tasks = ref([])
const listening = ref(false)
const error = ref(null)

let recognition

// Initialize SpeechRecognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

  recognition = new SpeechRecognition()
  recognition.lang = 'en-US'
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    listening.value = true
    error.value = null
  }

  recognition.onerror = (e) => {
    error.value = `Error: ${e.error}`
    listening.value = false
  }

  recognition.onend = () => {
    listening.value = false
  }

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim()
    tasks.value.push(transcript)
  }
} else {
  error.value = 'Speech recognition not supported in this browser.'
}

const startListening = () => {
  if (recognition) {
    recognition.start()
  }
}
</script>

<style>
body {
  font-family: system-ui, sans-serif;
}
</style>
