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
        @touchstart="startListening"
        @touchend="stopListening"
    >
      +
    </button>

    <p class="mt-4 text-gray-500">Hold the button and speak to add a task</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const tasks = ref([])
const recognition = ref(null)
const isListening = ref(false)

onMounted(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.")
    return
  }

  recognition.value = new SpeechRecognition()
  recognition.value.continuous = false
  recognition.value.lang = 'en-US'

  recognition.value.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    tasks.value.push(transcript)
  }

  recognition.value.onerror = (event) => {
    console.error('Speech error:', event)
  }
})

const startListening = () => {
  if (recognition.value && !isListening.value) {
    isListening.value = true
    recognition.value.start()
  }
}

const stopListening = () => {
  if (recognition.value && isListening.value) {
    recognition.value.stop()
    isListening.value = false
  }
}
</script>

<style>
body {
  font-family: sans-serif;
}
</style>
