<script setup lang="ts">
interface Props {
  variant?: 'button' | 'link' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'button',
  size: 'md'
});

const BMC_URL = 'https://buymeacoffee.com/elliottwalls';

function handleClick() {
  // Track that user clicked (for analytics/remembering they've seen it)
  if (process.client) {
    localStorage.setItem('bmc_prompt_seen', 'true');
  }
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2'
};

const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5'
};
</script>

<template>
  <a
    :href="BMC_URL"
    target="_blank"
    rel="noopener noreferrer"
    @click="handleClick"
    :class="[
      'inline-flex items-center gap-1.5 transition-all duration-200',
      variant === 'button' && 'rounded-lg font-medium hover:shadow-md hover:scale-105',
      variant === 'link' && 'text-primary-600 dark:text-primary-400 hover:underline',
      variant === 'subtle' && 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
      sizeClasses[size]
    ]"
    :style="variant === 'button' ? {
      background: 'linear-gradient(135deg, #FFDD00 0%, #FBB034 100%)',
      color: '#000'
    } : ''"
    class="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 cursor-pointer"
  >
    <!-- Coffee Cup Icon -->
    <svg
      :class="iconSizes[size]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
    <span v-if="variant !== 'subtle'">Buy me a coffee</span>
    <span v-else>Support Unfold</span>
  </a>
</template>

