<script setup lang="ts">
const authStore = useAuthStore();

// The global middleware will handle redirects
// This is just a loading state while middleware runs
onMounted(() => {
  // Redirect based on auth state
  if (authStore.isAuthenticated) {
    navigateTo('/dashboard');
  } else {
    navigateTo('/login');
  }
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary-600" />
      <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
</template>

