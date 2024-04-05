<template>
  <div>
    <button @click="speak">Click to Hear Voice Response</button>
  </div>
</template>

<script>
export default {
  methods: {
    speak() {
      const message = new SpeechSynthesisUtterance('Hello, this is an auto voice response.');
      window.speechSynthesis.speak(message);
    }
  }
};
</script>
