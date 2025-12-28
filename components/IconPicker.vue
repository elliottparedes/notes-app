<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const props = defineProps<{
  modelValue?: string | null;
  searchPlaceholder?: string;
  allowUpload?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
}>();

const authStore = useAuthStore();
const searchQuery = ref('');
const showPicker = ref(false);
const mode = ref<'select' | 'upload'>('select');
const isUploading = ref(false);
const uploadError = ref<string | null>(null);

function isUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes('/') || value.startsWith('http');
}

// Validated list of popular Lucide icons that actually exist
// Icons are stored in the database as strings (e.g., "folder", "home", etc.)
// and displayed using Iconify format: i-lucide-{icon-name}
const popularIcons = [
  // Files & Folders
  'folder', 'folder-open', 'folder-plus', 'folder-minus', 'folder-check', 'folder-x', 'folder-clock',
  'folder-lock', 'folder-key', 'folder-heart', 'folder-tree', 'folders',
  'file', 'file-text', 'file-plus', 'file-minus', 'file-check', 'file-x', 'file-edit',
  'file-search', 'file-clock', 'file-heart', 'file-code', 'file-json', 'file-image',
  'file-video', 'file-audio', 'files', 'archive', 'package', 'box', 'inbox',

  // Books & Learning
  'book', 'book-open', 'book-marked', 'book-copy', 'notebook', 'library', 'bookmark',
  'bookmark-plus', 'bookmark-minus', 'bookmark-check', 'graduation-cap', 'school',
  'backpack', 'pencil-ruler', 'pen-tool', 'highlighter',

  // Work & Business
  'briefcase', 'building', 'building-2', 'store', 'factory', 'warehouse', 'landmark',
  'presentation', 'projector', 'wallet', 'credit-card', 'banknote',
  'dollar-sign', 'euro', 'pound-sterling', 'coins', 'receipt', 'calculator',
  'scale',

  // Communication
  'mail', 'mail-open', 'mail-plus', 'mail-minus', 'mail-check', 'mail-x', 'inbox',
  'send', 'send-horizontal', 'paperclip', 'at-sign', 'hash', 'phone', 'phone-call',
  'phone-incoming', 'phone-outgoing', 'phone-missed', 'phone-off', 'voicemail',
  'message-square', 'message-circle', 'messages-square', 'speech', 'quote',

  // People & Users
  'user', 'user-plus', 'user-minus', 'user-check', 'user-x', 'user-cog', 'user-circle',
  'user-round', 'users', 'users-round', 'contact', 'contact-round', 'id-card',
  'user-search', 'badge', 'smile', 'frown', 'meh', 'laugh', 'angry',

  // Time & Calendar
  'calendar', 'calendar-days', 'calendar-plus', 'calendar-minus', 'calendar-check', 'calendar-x',
  'calendar-clock', 'calendar-heart', 'clock', 'alarm-clock', 'timer', 'hourglass',
  'watch', 'calendar-range',

  // Settings & Tools
  'settings', 'settings-2', 'cog', 'wrench', 'hammer',
  'sliders-horizontal', 'sliders-vertical', 'wand', 'wand-sparkles',
  'palette', 'paintbrush', 'brush', 'pipette',

  // Favorites & Reactions
  'heart', 'heart-pulse', 'heart-handshake', 'star', 'star-half', 'thumbs-up', 'thumbs-down',
  'hand', 'handshake', 'gem', 'diamond', 'crown', 'sparkles', 'sparkle',

  // Media & Entertainment
  'music', 'music-2', 'music-3', 'music-4', 'headphones', 'mic', 'mic-off', 'radio',
  'podcast', 'disc', 'disc-2', 'disc-3', 'tv', 'monitor', 'monitor-speaker',
  'camera', 'camera-off', 'video', 'video-off', 'film', 'clapperboard', 'image',
  'gallery-vertical', 'gallery-horizontal', 'gallery-thumbnails', 'picture-in-picture',
  'gamepad', 'gamepad-2', 'joystick', 'dice-1', 'dice-2', 'dice-3', 'dice-4', 'dice-5', 'dice-6',

  // Writing & Design
  'pen', 'pen-line', 'pencil', 'pencil-line', 'edit', 'edit-2', 'edit-3',
  'feather', 'type', 'text', 'text-cursor', 'italic', 'bold', 'underline',
  'strikethrough', 'subscript', 'superscript', 'heading', 'heading-1', 'heading-2',
  'pilcrow', 'quote', 'list', 'list-ordered', 'list-checks', 'list-todo',

  // Ideas & Innovation
  'lightbulb', 'lamp', 'lamp-desk', 'lamp-floor', 'zap', 'zap-off', 'flashlight',
  'flame', 'sun', 'moon', 'stars', 'sparkles', 'wand-sparkles', 'rocket',
  'atom', 'orbit', 'cylinder', 'square-asterisk',

  // Goals & Achievement
  'target', 'flag', 'flag-triangle-right', 'trophy', 'award', 'medal', 'gift',
  'ribbon', 'badge-check', 'badge-alert', 'badge-info', 'badge-help',
  'check-circle', 'check-square', 'check', 'circle-check', 'square-check',

  // Security & Privacy
  'lock', 'lock-open', 'unlock', 'key', 'key-round', 'shield', 'shield-check',
  'shield-alert', 'shield-x', 'shield-off', 'fingerprint', 'scan', 'scan-face',
  'scan-eye', 'eye', 'eye-off',

  // Actions
  'trash', 'trash-2', 'x', 'x-circle', 'x-square', 'check', 'plus', 'plus-circle',
  'plus-square', 'minus', 'minus-circle', 'minus-square', 'save', 'save-all',
  'download', 'upload', 'copy', 'clipboard', 'clipboard-copy', 'clipboard-check',
  'clipboard-list', 'scissors', 'rotate-ccw', 'rotate-cw', 'refresh-ccw',
  'refresh-cw', 'repeat', 'repeat-1', 'shuffle', 'skip-back', 'skip-forward',
  'rewind', 'fast-forward', 'play', 'pause', 'volume', 'volume-1',
  'volume-2', 'volume-x', 'maximize', 'minimize', 'expand', 'shrink',

  // Sharing & Connection
  'share', 'share-2', 'link', 'link-2', 'external-link', 'unlink', 'wifi', 'wifi-off',
  'bluetooth', 'cast', 'airplay', 'rss', 'podcast', 'git-branch', 'git-commit',
  'git-fork', 'git-merge', 'git-pull-request',

  // Navigation & Arrows
  'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right', 'arrow-up-left',
  'arrow-down-right', 'arrow-down-left', 'chevron-right', 'chevron-left', 'chevron-up',
  'chevron-down', 'chevrons-right', 'chevrons-left', 'chevrons-up', 'chevrons-down',
  'chevron-first', 'chevron-last', 'move', 'move-diagonal', 'move-horizontal',
  'move-vertical', 'corner-up-right', 'corner-up-left', 'corner-down-right',
  'corner-down-left', 'trending-up', 'trending-down',

  // UI & Layout
  'menu', 'more-horizontal', 'more-vertical', 'grip', 'grip-horizontal', 'grip-vertical',
  'align-left', 'align-center', 'align-right', 'align-justify', 'grid-3x3', 'grid-2x2',
  'layout', 'layout-grid', 'layout-list', 'sidebar', 'sidebar-open', 'sidebar-close',
  'panel-left', 'panel-right', 'panel-top', 'panel-bottom', 'columns', 'rows',
  'maximize-2', 'minimize-2', 'picture-in-picture-2', 'split', 'columns-3',

  // Search & Filter
  'search', 'search-check', 'search-x', 'filter', 'filter-x', 'scan-search',
  'zoom-in', 'zoom-out', 'focus', 'crosshair', 'scan-line',

  // Location & Travel
  'map', 'map-pin', 'map-pinned', 'navigation', 'navigation-2', 'compass', 'route',
  'signpost', 'milestone', 'footprints', 'plane', 'plane-takeoff', 'plane-landing',
  'car', 'car-front', 'bike', 'bus', 'train', 'train-front', 'ship', 'sailboat',
  'truck', 'tractor', 'hotel', 'bed', 'tent', 'luggage', 'ticket', 'tickets',

  // Food & Drink
  'coffee', 'cup-soda', 'beer', 'wine', 'glass-water', 'utensils', 'utensils-crossed',
  'chef-hat', 'cake', 'cake-slice', 'pizza', 'croissant', 'sandwich', 'egg',
  'egg-fried', 'apple', 'banana', 'cherry', 'grape', 'carrot', 'wheat',
  'ice-cream-cone', 'ice-cream-bowl', 'milk', 'popcorn', 'cookie', 'candy',
  'fish', 'drumstick', 'beef', 'salad',

  // Health & Fitness
  'heart-pulse', 'activity', 'stethoscope', 'syringe', 'pill', 'thermometer',
  'dumbbell', 'bike', 'footprints', 'watch', 'heart', 'cross', 'ambulance',

  // Nature & Weather
  'globe', 'earth', 'leaf', 'tree-pine', 'tree-deciduous', 'flower', 'flower-2',
  'sprout', 'palmtree', 'mountain', 'waves', 'sun', 'moon', 'sunrise',
  'sunset', 'cloud', 'cloud-sun', 'cloud-moon', 'cloud-rain', 'cloud-snow',
  'cloud-lightning', 'cloud-drizzle', 'cloud-fog', 'wind', 'snowflake', 'droplet',
  'droplets', 'umbrella', 'rainbow', 'flame', 'shell', 'bug', 'squirrel', 'bird',
  'fish', 'rabbit', 'turtle', 'dog', 'cat', 'paw-print', 'bone', 'feather',

  // Science & Technology
  'atom', 'microscope', 'telescope', 'flask-conical', 'flask-round', 'beaker',
  'test-tube', 'test-tubes', 'dna', 'brain', 'cpu', 'hard-drive', 'server',
  'database', 'laptop', 'smartphone', 'tablet', 'watch', 'monitor', 'mouse',
  'mouse-pointer', 'keyboard', 'webcam', 'printer', 'usb', 'bluetooth',
  'wifi', 'signal', 'battery', 'battery-charging', 'battery-low', 'plug', 'plug-zap',
  'power', 'power-off', 'zap', 'satellite', 'satellite-dish', 'radio-tower',
  'router', 'gauge', 'gauge-circle',

  // Shopping & Commerce
  'shopping-cart', 'shopping-bag', 'shopping-basket', 'store', 'tag', 'tags',
  'ticket', 'barcode', 'qr-code', 'receipt', 'percent', 'gift', 'package',
  'truck', 'megaphone', 'trending-up', 'trending-down',

  // Alerts & Info
  'bell', 'bell-ring', 'bell-off', 'bell-plus', 'bell-minus', 'info', 'help-circle',
  'alert-circle', 'alert-triangle', 'alert-octagon', 'construction', 'cone',
  'octagon-x', 'triangle-alert', 'circle-alert', 'badge-alert', 'badge-info',

  // Code & Development
  'code', 'code-2', 'terminal', 'braces', 'brackets', 'parentheses', 'slash',
  'binary', 'hash', 'regex', 'function-square', 'variable', 'equal',
  'bug', 'bug-off', 'package-check', 'package-plus', 'package-minus', 'package-x',

  // Home & Living
  'house', 'home', 'door-open', 'door-closed', 'warehouse', 'armchair', 'sofa',
  'bed', 'bed-double', 'bed-single', 'lamp', 'lamp-ceiling', 'lamp-desk', 'lamp-floor',
  'bath', 'shower-head', 'refrigerator', 'microwave', 'washing-machine',
  'shirt',

  // Miscellaneous
  'puzzle', 'dice-6', 'piano', 'guitar', 'drum', 'palette', 'frame', 'anchor',
  'ferris-wheel', 'key-square', 'key-round', 'megaphone', 'pyramid',
  'trophy', 'volleyball', 'dumbbell', 'bike'
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

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];
  isUploading.value = true;
  uploadError.value = null;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const { url } = await $fetch<{ url: string }>('/api/folders/upload-icon', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: formData
    });

    selectedIcon.value = url;
    showPicker.value = false;
  } catch (error: any) {
    console.error('Upload failed:', error);
    uploadError.value = error.message || 'Failed to upload icon';
  } finally {
    isUploading.value = false;
    // Reset input
    input.value = '';
  }
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
        <img 
          v-if="isUrl(selectedIcon)" 
          :src="selectedIcon!" 
          class="w-8 h-8 object-contain"
          alt="Selected icon"
        />
        <UIcon 
          v-else-if="selectedIcon" 
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
        <!-- Mode Switcher -->
        <div v-if="allowUpload" class="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            @click="mode = 'select'"
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="mode === 'select' 
              ? 'text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800 border-b-2 border-primary-500' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Library
          </button>
          <button
            type="button"
            @click="mode = 'upload'"
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="mode === 'upload' 
              ? 'text-primary-600 dark:text-primary-400 bg-gray-50 dark:bg-gray-800 border-b-2 border-primary-500' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Upload
          </button>
        </div>

        <!-- Library Mode -->
        <template v-if="mode === 'select'">
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
                :autofocus="true"
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
        </template>

        <!-- Upload Mode -->
        <template v-else>
          <div class="p-6 flex flex-col items-center justify-center text-center">
            <div 
              class="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer relative"
            >
              <input 
                type="file" 
                @change="handleFileUpload" 
                accept="image/*"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                :disabled="isUploading"
              />
              <div v-if="isUploading" class="space-y-2">
                <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto animate-spin text-primary-500" />
                <p class="text-sm font-medium text-gray-900 dark:text-white">Uploading...</p>
              </div>
              <div v-else class="space-y-2">
                <UIcon name="i-heroicons-cloud-arrow-up" class="w-10 h-10 mx-auto text-gray-400" />
                <p class="text-sm font-medium text-gray-900 dark:text-white">Click to upload</p>
                <p class="text-xs text-gray-500">SVG, PNG, JPG, WEBP (max 2MB)</p>
              </div>
            </div>
            
            <p v-if="uploadError" class="mt-2 text-sm text-red-600 dark:text-red-400">
              {{ uploadError }}
            </p>
          </div>
        </template>

        <!-- Footer -->
        <div v-if="mode === 'select'" class="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400 text-center">
          {{ filteredIcons.length }} icon{{ filteredIcons.length !== 1 ? 's' : '' }} available
        </div>
      </div>
    </Transition>
  </div>
</template>

