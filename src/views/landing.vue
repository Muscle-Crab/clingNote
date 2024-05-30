<template>
  <div class="bg-gray-900 text-white min-h-screen">
    <div class="py-20">
      <div class="container mx-auto px-4">
        <h1 class="text-4xl font-bold text-center mb-8">Welcome to ClingNote</h1>
        <p class="text-lg text-center mb-8">ClingNote is your go-to app for posting topics and getting opinions</p>
        <div class="flex justify-center">
          <button @click="speak" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center">
            <i class="fas fa-play-circle mr-2"></i> Listen
          </button>
        </div>
        <div class="max-w-3xl mx-auto mb-12">
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">1</div>
            <p class="text-lg">Sign up for an account on ClingNote.</p>
          </div>

          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">2</div>
            <p class="text-lg">Create a room</p>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">3</div>
            <p class="text-lg">Post a topic and get feedback from other.</p>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">4</div>
            <p class="text-lg">Stay connected and updated with your loved ones!</p>
          </div>

          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">6</div>
            <p class="text-lg">Create and join rooms to chat and share experiences.</p>
          </div>
          <div class=" items-center mb-4">
            <div class="flex item-center">
              <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">7</div>
              <p class="text-lg">Engage with others with post like the following</p>
            </div>
            <ul class="list-disc ml-8">
              <li v-for="question in situationalQuestions" :key="question.id" class="text-gray-300">{{ question.text }}</li>
            </ul>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">8</div>
            <p class="text-lg">Like and comment on posts from your family and friends.</p>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">9</div>
            <p class="text-lg">Receive notifications for new posts and updates.</p>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">10</div>
            <p class="text-lg">Customize your profile and privacy settings.</p>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">11</div>
            <p class="text-lg">Explore and join public groups based on your interests.</p>
          </div>
          <div class="flex items-center mb-4">
            <div class="rounded-full bg-blue-500 text-white text-center w-8 h-8 flex justify-center items-center mr-2">11</div>
            <p class="text-lg">I'm always open to new ideas so let me know if you have any new feature</p>
          </div>
        </div>
        <div class="flex justify-center">
          <button  class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center">
           <router-link to="/register"> <span>
               Get Started
            </span></router-link>
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LandingPage',
  data() {
    return {
      situationalQuestions: [
        {id: 1, text: 'Will there ever be a player to break Messi\'s 91 goal record'},
        {id: 2, text: 'What music you could listen for an hour loop '},
        {id: 3, text: 'If you could instantly master any musical instrument, which one would you choose?'},
        {id: 4, text: 'If Jamaica had the same currency as Us, How often do you think people would travel'},
        {id: 5, text: ' Will Robots Take Our Jobs The '},
        {id: 6, text: 'Imagine having Messi, Ronaldo, Maradona and Pele as substitute and you need one goal to win on the 85th, who would you choose?'}
      ]
    };
  },
  methods: {
    speak() {
      // Get all elements with text content
      const elementsWithText = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');
      let text = '';

      // Concatenate text content of all elements
      elementsWithText.forEach(element => {
        text += element.textContent + ' ';
      });

      // Speak the concatenated text
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
/* Tailwind CSS classes can be used directly */
</style>
