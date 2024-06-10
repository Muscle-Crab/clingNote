<template>
  <div v-if="loading" class="animate-pulse">
    <!-- Skeleton Loader for Participants -->
    <div class="col-span-1 bg-gray-800 rounded-lg shadow-md p-6 mb-8 dark:bg-gray-800 item-start">
      <h2 class="text-xl font-semibold text-gray-200 mb-4">Participants</h2>
      <ul class="space-y-4">
        <li class="flex items-center">
          <div class="w-12 h-12 bg-gray-600 rounded-full mr-4"></div>
          <div class="h-4 bg-gray-600 rounded w-24"></div>
        </li>
        <li class="flex items-center">
          <div class="w-12 h-12 bg-gray-600 rounded-full mr-4"></div>
          <div class="h-4 bg-gray-600 rounded w-24"></div>
        </li>
        <li class="flex items-center">
          <div class="w-12 h-12 bg-gray-600 rounded-full mr-4"></div>
          <div class="h-4 bg-gray-600 rounded w-24"></div>
        </li>
      </ul>
    </div>

    <!-- Skeleton Loader for Posts -->
    <div class="col-span-2 grid grid-cols-1 gap-8">
      <div class="md:min-w-[320px]">
        <div class="min-w-sm p-6 bg-gray-600 border border-gray-500 rounded-lg shadow dark:bg-gray-800">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <div class="w-12 h-12 bg-gray-600 rounded-full mr-2"></div>
              <div class="h-4 bg-gray-600 rounded w-24"></div>
            </div>
          </div>
          <div class="h-4 bg-gray-600 rounded mb-2"></div>
          <div class="h-4 bg-gray-600 rounded mb-2"></div>
          <div class="h-4 bg-gray-600 rounded mb-4"></div>
          <div class="flex justify-between items-center">
            <div class="h-6 bg-gray-600 rounded w-12"></div>
            <div class="h-6 bg-gray-600 rounded w-12"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Skeleton Loader for Actions -->
    <div class="col-span-1 bg-gray-800 rounded-lg shadow-md p-6 dark:bg-gray-800">
      <h2 class="text-xl font-semibold text-gray-200 mb-4">Actions</h2>
      <div class="h-12 bg-gray-600 rounded mb-4"></div>
      <div class="h-12 bg-gray-600 rounded mb-4"></div>
      <div class="h-12 bg-gray-600 rounded mb-4"></div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    loading: {
      type: Boolean,
      required: true,
    },
  },
};
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
