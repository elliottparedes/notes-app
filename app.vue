<script setup lang="ts">
const toaster = { position: 'top-right' as const }

useHead({
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '192x192' }
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#10b981' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Notes' }
  ]
})
</script>

<template>
  <UApp :toaster="toaster">
    <VitePwaManifest />
    <NuxtPage />
  </UApp>
</template>

