<script setup lang="ts">
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notesStore = useNotesStore();
const foldersStore = useFoldersStore();
const spacesStore = useSpacesStore();

// Determine active route
const activeRoute = computed(() => {
  const path = route.path;
  if (path === '/dashboard') return 'home';
  if (path === '/settings') return 'settings';
  if (path.startsWith('/notes/')) return 'notes';
  return 'home';
});

// Navigation items (mobile IA: Home, Me)
const navItems = [
  {
    id: 'home',
    label: 'Home',
    icon: 'i-heroicons-home',
    route: '/dashboard',
    badge: null
  },
  {
    id: 'settings',
    label: 'Me',
    icon: 'i-heroicons-user-circle',
    route: '/settings',
    badge: null
  }
];

const emit = defineEmits<{
}>();

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
        :class="[
          'relative flex flex-col items-center justify-center gap-1.5 flex-1 h-full rounded-2xl transition-all duration-300 active:scale-95',
          item.isPrimary 
            ? 'mx-2' 
            : ''
        ]"
      >
        <!-- Active indicator background -->
        <div
          v-if="activeRoute === item.id && !item.isPrimary"
          class="absolute inset-0 bg-primary-50 dark:bg-primary-900/30 rounded-2xl transition-all duration-300"
        />
        
        <!-- Active indicator dot -->
        <div
          v-if="activeRoute === item.id && !item.isPrimary"
          class="absolute top-1.5 w-1 h-1 bg-primary-600 dark:bg-primary-400 rounded-full transition-all duration-300"
        />
        
        <!-- Icon container -->
        <div class="relative z-10">
          <UIcon 
            :name="item.icon" 
            :class="[
              'transition-all duration-300',
              item.isPrimary
                ? 'w-8 h-8 text-primary-600 dark:text-primary-400'
                : activeRoute === item.id
                  ? 'w-6 h-6 text-primary-600 dark:text-primary-400'
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
            activeRoute === item.id && !item.isPrimary
              ? 'text-primary-600 dark:text-primary-400'
              : item.isPrimary
                ? 'text-primary-600 dark:text-primary-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400'
          ]"
        >
          {{ item.label }}
        </span>
        
        <!-- Primary button special styling -->
        <div
          v-if="item.isPrimary"
          class="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl opacity-0 hover:opacity-10 active:opacity-20 transition-opacity duration-200 pointer-events-none"
        />
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

