<script setup lang="ts">
import type { Folder } from '~/models';

interface Props {
  folder: Folder;
  selectedId: number | null;
}

interface Emits {
  (e: 'select', folderId: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

function handleSelect() {
  emit('select', props.folder.id);
}
</script>

<template>
  <div>
    <!-- Folder Item -->
    <button
      type="button"
      @click="handleSelect"
      class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
      style="padding-left: 16px;"
      :class="selectedId === folder.id ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''"
    >
      <UIcon name="i-heroicons-folder" class="w-4 h-4 text-blue-500 flex-shrink-0" />
      <span class="truncate">{{ folder.name }}</span>
    </button>
  </div>
</template>

