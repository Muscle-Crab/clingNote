<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
    <div class="w-full max-w-md h-96 overflow-hidden border rounded-xl shadow-xl bg-white relative">
      <h2 class="text-lg font-bold text-center py-3 bg-gray-50 border-b">
        ⚠️ Urgent Tasks Conveyor
      </h2>

      <!-- Scroll Container -->
      <div class="absolute w-full h-[200%] animate-scroll-down pointer-events-none">
        <div class="space-y-4">
          <ul v-for="i in 2" :key="i">
            <li
                v-for="task in tasks"
                :key="task.id + '-copy-' + i"
                class="bg-red-100 text-red-900 px-4 py-3 rounded-lg shadow-md w-11/12 mx-auto mb-2 flex justify-between items-center pointer-events-auto"
                :class="{ 'line-through opacity-50': task.completed }"
            >
              <div>
                <h3 class="font-semibold text-base">{{ task.title }}</h3>
                <p class="text-sm">{{ task.description }}</p>
              </div>
              <input type="checkbox" v-model="task.completed" />
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      tasks: [
        { id: 1, title: 'Fix UI Bug', description: 'Priority: High', completed: false },
        { id: 2, title: 'Client Call', description: '3 PM sharp', completed: false },
        { id: 3, title: 'Prepare Proposal', description: 'Due in 2 hrs', completed: false },
        { id: 4, title: 'Post on Twitter', description: 'Engage community', completed: false },
        { id: 5, title: 'Team Sync', description: 'Daily standup', completed: false },
        { id: 6, title: 'Check Firebase Logs', description: 'Inspect errors', completed: false },
        { id: 7, title: 'Finalize Slides', description: 'Review content', completed: false }
      ]
    };
  }
};
</script>

<style scoped>
@keyframes scroll-down {
  0% {
    transform: translateY(-50%);
  }
  100% {
    transform: translateY(0%);
  }
}

.animate-scroll-down {
  animation: scroll-down 10s linear infinite;
}

/* Prevent animation from blocking interactivity */
.pointer-events-none * {
  pointer-events: auto;
}
</style>
