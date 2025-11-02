<script setup lang="ts">
const props = defineProps<{
  modelValue?: string | null;
  searchPlaceholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
}>();

const searchQuery = ref('');
const showPicker = ref(false);

// Validated list of popular Lucide icons that actually exist
// Icons are stored in the database as strings (e.g., "folder", "home", etc.)
// and displayed using Iconify format: i-lucide-{icon-name}
const popularIcons = [
  'folder', 'file', 'book', 'notebook', 'folder-open', 'archive',
  'briefcase', 'building', 'building-2', 'store',
  'school', 'book-open', 'library', 'bookmark', 'calendar', 'calendar-days',
  'clock', 'alarm-clock', 'timer', 'inbox', 'mail', 'paperclip', 'send',
  'message-square', 'users', 'user', 'user-plus', 'users-round',
  'settings', 'cog', 'wrench', 'heart', 'star', 'thumbs-up', 'thumbs-down',
  'smile', 'music', 'headphones', 'radio', 'tv', 'monitor', 'camera',
  'palette', 'paintbrush', 'brush', 'pen', 'pencil', 'lightbulb', 'zap',
  'sparkles', 'target', 'flag', 'trophy', 'award', 'medal', 'badge',
  'lock', 'key', 'shield', 'shield-check', 'trash', 'trash-2', 'x',
  'check', 'plus', 'minus', 'save', 'download', 'upload', 'share',
  'link', 'external-link', 'arrow-right', 'arrow-left',
  'chevron-right', 'chevron-left', 'chevron-up', 'chevron-down', 'menu',
  'search', 'filter', 'grid-3x3', 'list', 'map', 'map-pin', 'navigation',
  'compass', 'globe', 'plane', 'car', 'bike', 'truck', 'coffee', 'utensils',
  'chef-hat', 'cake', 'gamepad-2', 'dice-6', 'puzzle', 'heart-pulse',
  'activity', 'chart-line', 'trending-up', 'bar-chart-3', 'pie-chart',
  'wallet', 'credit-card', 'dollar-sign', 'coins', 'receipt', 'laptop',
  'smartphone', 'tablet', 'mouse', 'keyboard', 'hard-drive', 'cloud',
  'cloud-upload', 'cloud-download', 'database', 'server', 'box', 'package',
  'shopping-cart', 'shopping-bag', 'tag', 'ticket', 'bell', 'bell-ring',
  'info', 'code', 'terminal', 'cpu', 'battery', 'plug', 'moon', 'sun',
  'sunrise', 'sunset', 'cloud-sun', 'wind', 'umbrella', 'droplet', 'flame',
  'snowflake', 'rainbow', 'flask-conical', 'beaker', 'microscope',
  'atom', 'rocket', 'satellite', 'earth', 'leaf', 'tree-pine',
  'flower', 'cherry', 'grape', 'milk', 'ice-cream-bowl', 'pizza',
  'apple', 'fish', 'drumstick', 'beef', 'egg', 'croissant', 'sandwich', 'wheat', 'tree-deciduous', 'sprout',
  'bug', 'dog', 'cat', 'bird', 'turtle', 'rabbit', 'paw-print', 'bone', 'feather', 'house'
];

// Map icon names to their search keywords for better searchability
const allIcons = popularIcons.map(name => ({
  name,
  keywords: name.split('-').join(' ') + ' ' + name.replace(/-/g, ' ')
}));

// Filter icons based on search query
const filteredIcons = computed(() => {
  if (!searchQuery.value.trim()) {
    return allIcons; // Show all popular icons by default
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  return allIcons.filter(icon => {
    const searchTerms = query.split(/\s+/);
    return searchTerms.every(term => 
      icon.keywords.includes(term) || 
      icon.name.includes(term)
    );
  });
});

const selectedIcon = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

function selectIcon(iconName: string) {
  selectedIcon.value = iconName;
  showPicker.value = false;
  searchQuery.value = '';
}

function clearIcon() {
  selectedIcon.value = null;
  showPicker.value = false;
}

// Close picker when clicking outside
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.icon-picker-container')) {
      showPicker.value = false;
    }
  };
  
  document.addEventListener('click', handleClickOutside);
  onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
  });
});
</script>

<template>
  <div class="icon-picker-container relative">
    <!-- Icon Preview Button -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        @click.stop="showPicker = !showPicker"
        class="flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
        :class="selectedIcon 
          ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 shadow-sm' 
          : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900'"
        title="Select icon"
      >
        <UIcon 
          v-if="selectedIcon" 
          :name="`i-lucide-${selectedIcon}`" 
          class="w-5 h-5 text-primary-600 dark:text-primary-400"
        />
        <UIcon 
          v-else 
          name="i-heroicons-photo" 
          class="w-5 h-5 text-gray-400 dark:text-gray-500"
        />
      </button>
      
      <div class="flex-1">
        <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Icon
        </label>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ selectedIcon ? 'Click to change icon' : 'Click to select an icon' }}
        </p>
      </div>
      
      <button
        v-if="selectedIcon"
        type="button"
        @click.stop="clearIcon"
        class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="Remove icon"
      >
        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
      </button>
    </div>

    <!-- Icon Picker Dropdown -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-2"
    >
      <div
        v-if="showPicker"
        class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
        @click.stop
      >
        <!-- Search Bar -->
        <div class="p-3 border-b border-gray-200 dark:border-gray-700">
          <div class="relative">
            <UIcon 
              name="i-heroicons-magnifying-glass" 
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="searchPlaceholder || 'Search icons...'"
              class="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              autofocus
            />
          </div>
        </div>

        <!-- Icons Grid -->
        <div class="max-h-80 overflow-y-auto p-3">
          <div 
            v-if="filteredIcons.length === 0"
            class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No icons found</p>
            <p class="text-xs mt-1">Try a different search term</p>
          </div>
          <div 
            v-else
            class="grid grid-cols-8 gap-2"
          >
            <button
              v-for="icon in filteredIcons"
              :key="icon.name"
              @click="selectIcon(icon.name)"
              class="group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:scale-110"
              :class="selectedIcon === icon.name 
                ? 'bg-primary-500 dark:bg-primary-600 ring-2 ring-primary-300 dark:ring-primary-700' 
                : 'bg-gray-50 dark:bg-gray-900 hover:border-primary-300 dark:hover:border-primary-700 border border-gray-200 dark:border-gray-700'"
              :title="icon.name"
            >
              <UIcon 
                :name="`i-lucide-${icon.name}`"
                class="w-5 h-5 transition-colors"
                :class="selectedIcon === icon.name 
                  ? 'text-white' 
                  : 'text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'"
              />
              <!-- Checkmark for selected icon -->
              <div
                v-if="selectedIcon === icon.name"
                class="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 dark:bg-primary-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800"
              >
                <UIcon name="i-heroicons-check" class="w-2.5 h-2.5 text-white" />
              </div>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 text-center">
          {{ filteredIcons.length }} icon{{ filteredIcons.length !== 1 ? 's' : '' }} available
        </div>
      </div>
    </Transition>
  </div>
</template>

