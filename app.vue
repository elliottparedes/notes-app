<script setup lang="ts">
const toaster = { position: 'top-right' as const }
</script>

<template>
  <UApp :toaster="toaster">
    <NuxtPage />
  </UApp>
</template>

