<script setup lang="ts">
import { Notivue, Notification, pastelTheme } from 'notivue'

const { baseUrl } = useSEO()

// Global Organization schema
useHead({
  link: [
    { rel: 'icon', type: 'image/png', href: '/swan-unfold.png' },
    { rel: 'apple-touch-icon', href: '/swan-unfold.png', sizes: '192x192' },
    { rel: 'alternate', type: 'application/rss+xml', href: `${baseUrl}/rss.xml` }
  ],
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#ffffff' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Unfold' },
    { name: 'format-detection', content: 'telephone=no' }
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Unfold Notes',
        url: baseUrl,
        logo: `${baseUrl}/swan-unfold.png`,
        description: 'Modern note-taking app with AI-powered features and real-time collaboration',
        sameAs: [
          // Add social media links when available
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Customer Support',
          availableLanguage: 'English'
        }
      })
    }
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

