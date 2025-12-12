<script setup lang="ts">
const router = useRouter();
const route = useRoute();

// Determine active route
const activeRoute = computed(() => {
  const path = route.path;
  if (path === '/mobile/home' || path === '/dashboard') return 'home';
  if (path === '/mobile/search') return 'search';
  if (path === '/mobile/ai-chat') return 'ai-chat';
  if (path === '/mobile/storage') return 'home'; // Storage shows home as active
  return 'home';
});

// Navigation items (mobile IA: Home, Search, AI Chat)
const navItems = [
  {
    id: 'home',
    label: 'Home',
    icon: 'i-heroicons-home',
    route: '/mobile/home',
    badge: null
  },
  {
    id: 'search',
    label: 'Search',
    icon: 'i-heroicons-magnifying-glass',
    route: '/mobile/search',
    badge: null
  },
  {
    id: 'ai-chat',
    label: 'AI',
    icon: 'i-heroicons-sparkles',
    route: '/mobile/ai-chat',
    badge: null
  }
];

function handleNavClick(item: typeof navItems[0]) {
  if (item.route) {
    router.push(item.route);
  }
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-700/50 safe-area-inset-bottom">
    <div class="flex items-center justify-around h-16 px-1">
      <button
        v-for="item in navItems"
        :key="item.id"
        @click="handleNavClick(item)"
        class="relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 active:scale-95"
      >
        <!-- Active indicator background -->
        <div
          v-if="activeRoute === item.id"
          class="absolute inset-0 bg-blue-50 dark:bg-blue-900/30 rounded-2xl transition-all duration-300"
        />
        
        <!-- Icon container -->
        <div class="relative z-10">
          <UIcon 
            :name="item.icon" 
            :class="[
              'transition-all duration-300',
              activeRoute === item.id
                ? 'w-6 h-6 text-blue-600 dark:text-blue-400'
                : 'w-6 h-6 text-gray-500 dark:text-gray-400'
            ]"
          />
          
          <!-- Badge -->
          <span
            v-if="item.badge"
            class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg border-2 border-white dark:border-gray-900"
          >
            {{ item.badge }}
          </span>
        </div>
        
        <!-- Label -->
        <span 
          :class="[
            'text-[11px] font-medium transition-all duration-300 relative z-10',
            activeRoute === item.id
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          {{ item.label }}
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* Safe area inset for devices with notches/home indicators */
.safe-area-inset-bottom {
  padding-bottom: max(env(safe-area-inset-bottom), 8px);
}

/* Ensure nav stays above content with modern shadow */
nav {
  box-shadow: 0 -1px 3px 0 rgba(0, 0, 0, 0.1), 0 -1px 2px 0 rgba(0, 0, 0, 0.06);
}

/* Smooth active state transitions */
button {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* Subtle hover effect for desktop (if user hovers) */
@media (hover: hover) {
  button:hover:not(.active) {
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  .dark button:hover:not(.active) {
    background-color: rgba(255, 255, 255, 0.02);
  }
}
</style>

