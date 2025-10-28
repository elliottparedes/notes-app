<script setup lang="ts">
import type { Folder } from '~/models';

interface Props {
  folder: Folder;
  selectedId: number | null;
  depth?: number;
}

interface Emits {
  (e: 'select', folderId: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0
});

const emit = defineEmits<Emits>();

const hasChildren = computed(() => {
  return props.folder.children && props.folder.children.length > 0;
});

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
      :style="{ paddingLeft: `${depth * 12 + 16}px` }"
      :class="selectedId === folder.id ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''"
    >
      <UIcon name="i-heroicons-folder" class="w-4 h-4 text-blue-500 flex-shrink-0" />
      <span class="truncate">{{ folder.name }}</span>
    </button>

    <!-- Children Folders (Recursive) -->
    <div v-if="hasChildren">
      <FolderSelectorItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :selected-id="selectedId"
        :depth="depth + 1"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

