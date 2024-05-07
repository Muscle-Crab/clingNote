<template>
  <div class="container mx-auto px-4 py-8 bg-gray-100">
    <h1 class="text-3xl font-bold text-gray-800 mb-12">Explore Rooms</h1>
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div v-for="room in rooms" class="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition duration-500">

        <div class="">

        </div>
        <div class="p-8 bg-white">
          <h5 class="text-xl font-bold text-black">{{ room.title }}</h5>
          <p class="text-gray-700">{{ room.description }}</p>
          <button class="block w-full mt-4 bg-gradient-to-r from-green-400 to-blue-500 hover:bg-gradient-to-l text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            <router-link :to="'/room/' + room.id" >
              Join Room
            </router-link>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      rooms: [
        { id: 1, title: 'Travel Enthusiasts', description: 'Share your travel stories and tips with fellow enthusiasts.', image: '@/assets/test.svg' },
        { id: 2, title: 'Movie Buffs', description: 'Discuss your favorite movies and share recommendations.', image: '@/assets/test.svg' },
        { id: 3, title: 'Food Lovers', description: 'Discover new recipes, restaurants, and culinary experiences.', image: '@/assets/test.svg' },
        { id: 4, title: 'Tech Talk', description: 'Discuss the latest in technology trends and gadgets.', image: '@/assets/test.svg' },
        { id: 5, title: 'Fitness & Wellness', description: 'Stay fit and healthy with workout tips and wellness advice.', image: '@/assets/test.svg' },
        { id: 6, title: 'Book Club', description: 'Join our book club discussions and share your favorite reads.', image: '@/assets/test.svg' }
        // Add more dummy rooms here
      ]
    };
  },
  methods: {
    joinRoom(roomId) {
      console.log("Joined room with ID:", roomId);
    },
    backgroundStyle(image) {
      return {
        backgroundImage: `url(${require(image)})`,
        backgroundSize: 'cover'
      };
    }
  }
};
</script>
<style scoped>
.container {
  max-width: 1200px;
}

/* Adjustments for small screens */
@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
