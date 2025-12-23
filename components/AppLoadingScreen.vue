<template>
  <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-gray-900 transition-colors duration-300">
    <div class="flex flex-col items-center">
      <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
      <p class="text-lg font-medium text-gray-700 dark:text-gray-300">Loading your notes...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// No script logic needed for a simple loading screen
</script>

<style scoped>
/* Add any specific styles if needed, though Tailwind should cover most */
</style>
