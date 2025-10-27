<script setup lang="ts">
// Server-side: redirect to login (safer default for non-authenticated users)
if (process.server) {
  await navigateTo('/login', { redirectCode: 302 });
}

// Client-side: check auth and redirect appropriately
if (process.client) {
  const hasToken = localStorage.getItem('auth_token');
  
  if (hasToken) {
    await navigateTo('/dashboard', { replace: true });
  } else {
    await navigateTo('/login', { replace: true });
  }
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

