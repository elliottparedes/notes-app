<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface NoteItem {
  id: string;
  title: string;
}

const props = defineProps<{
  items: NoteItem[];
  command: (item: any) => void;
}>();

const selectedIndex = ref(0);

function selectItem(index: number) {
  const item = props.items[index];
  if (item) {
    props.command({ id: item.id, label: item.title || 'Untitled Note' });
  }
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length;
    return true;
  }

  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length;
    return true;
  }

  if (event.key === 'Enter') {
    selectItem(selectedIndex.value);
    return true;
  }

  return false;
}

defineExpose({
  onKeyDown,
});
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl overflow-hidden min-w-[240px] z-[1000] py-1">
    <div class="px-3 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/50 mb-1">
      Link to Note
    </div>
    <template v-if="items.length">
      <div class="max-h-[300px] overflow-y-auto custom-scrollbar">
        <button
          v-for="(item, index) in items"
          :key="item.id"
          class="w-full text-left px-3 py-2 text-sm transition-all duration-200 block group"
          :class="{ 
            'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400': index === selectedIndex,
            'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50': index !== selectedIndex
          }"
          @click="selectItem(index)"
        >
          <div class="flex items-center gap-2.5">
            <div 
              class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              :class="index === selectedIndex ? 'bg-blue-100 dark:bg-blue-800/40' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'"
            >
              <UIcon name="i-heroicons-document-text" class="w-4 h-4 flex-shrink-0" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="truncate font-medium">{{ item.title || 'Untitled Note' }}</div>
              <div class="text-[10px] opacity-60 truncate">Note ID: {{ item.id.substring(0, 8) }}...</div>
            </div>
            <UIcon 
              v-if="index === selectedIndex" 
              name="i-heroicons-arrow-right" 
              class="w-3.5 h-3.5 opacity-50" 
            />
          </div>
        </button>
      </div>
    </template>
    <div v-else class="px-4 py-6 text-center">
      <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
      <div class="text-sm text-gray-500 dark:text-gray-400 italic">No matching notes</div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #374151;
}
</style>