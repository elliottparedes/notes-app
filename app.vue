<script setup lang="ts">
import { Notivue, Notification, pastelTheme } from 'notivue'

useHead({
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '192x192' }
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Notes' }
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

