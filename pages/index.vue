<script setup lang="ts">
// Redirect immediately on both server and client
definePageMeta({
  middleware: 'auth'
});

// Client-side redirect
if (process.client) {
  const authStore = useAuthStore();
  
  // Check localStorage for existing token
  const hasToken = localStorage.getItem('auth_token');
  
  if (hasToken) {
    navigateTo('/dashboard', { replace: true });
  } else {
    navigateTo('/login', { replace: true });
  }
}

// Server-side: just redirect to login (safer default)
if (process.server) {
  navigateTo('/login', { replace: true });
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary-600" />
      <p class="mt-4 text-gray-600 dark:text-gray-400">Redirecting...</p>
    </div>
  </div>
</template>

