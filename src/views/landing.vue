<template>
  <div class="p-6 max-w-md mx-auto">
    <div class="relative h-[400px]">
      <div
          v-for="(task, index) in tasks"
          :key="task.id"
          class="absolute left-0 right-0 transition-all duration-300"
          :style="{
          top: `${index * 8}px`, // tight stack
          zIndex: 100 - index
        }"
      >
        <div
            class="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-xl"
        >
          <h3 class="text-lg font-semibold text-gray-800 dark:text-white">
            {{ task.title }}
          </h3>
          <p class="text-gray-600 dark:text-gray-300">
            {{ task.description }}
          </p>
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
        {id: 1, title: 'Wake Up', description: 'Drink water and stretch'},
        {id: 2, title: 'Plan the Day', description: 'Review tasks and schedule'},
        {id: 3, title: 'Work Block', description: 'Focus on deep work'},
        {id: 4, title: 'Break Time', description: 'Relax and recharge'},
        {id: 5, title: 'Evening Review', description: 'Log progress and plan tomorrow'},
      ],
    };
  },
};
</script>
