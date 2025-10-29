<script setup lang="ts">
import { Notivue, Notification, pastelTheme } from 'notivue'

useHead({
  link: [
    { rel: 'icon', type: 'image/png', href: '/folder.png' },
    { rel: 'apple-touch-icon', href: '/folder.png', sizes: '192x192' }
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#ffffff' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Unfold' }
  ]
})
</script>

<template>
  <UApp>
    <Notivue v-slot="item">
      <Notification :item="item" :theme="pastelTheme" />
    </Notivue>
    <VitePwaManifest />
    <NuxtPage />
  </UApp>
</template>

