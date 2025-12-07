<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

const props = defineProps<{
  editor: Editor | null | undefined;
  isPolishing?: boolean;
}>();

const emit = defineEmits<{
  (e: 'insert-image'): void;
  (e: 'insert-youtube'): void;
  (e: 'insert-table'): void;
  (e: 'insert-link'): void;
  (e: 'polish'): void;
}>();

// Helper to check if active
const isActive = (name: string, attributes?: Record<string, any>) => {
  return props.editor?.isActive(name, attributes);
};

// Toolbar items configuration
const toolbarGroups = [
  {
    name: 'text',
    items: [
      {
        icon: 'i-heroicons-bold',
        title: 'Bold',
        action: () => props.editor?.chain().focus().toggleBold().run(),
        isActive: () => isActive('bold'),
      },
      {
        icon: 'i-heroicons-italic',
        title: 'Italic',
        action: () => props.editor?.chain().focus().toggleItalic().run(),
        isActive: () => isActive('italic'),
      },
      {
        icon: 'i-heroicons-strikethrough',
        title: 'Strike',
        action: () => props.editor?.chain().focus().toggleStrike().run(),
        isActive: () => isActive('strike'),
      },
      {
        icon: 'i-heroicons-code-bracket',
        title: 'Inline Code',
        action: () => props.editor?.chain().focus().toggleCode().run(),
        isActive: () => isActive('code'),
      },
      {
        icon: 'i-heroicons-command-line',
        title: 'Code Block',
        action: () => props.editor?.chain().focus().toggleCodeBlock().run(),
        isActive: () => isActive('codeBlock'),
      },
    ],
  },
  {
    name: 'headings',
    items: [
      {
        // icon: 'i-lucide-heading-1', // Using text label for reliability
        label: 'H1',
        title: 'Heading 1',
        action: () => props.editor?.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => isActive('heading', { level: 1 }),
      },
      {
        // icon: 'i-lucide-heading-2',
        label: 'H2',
        title: 'Heading 2',
        action: () => props.editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => isActive('heading', { level: 2 }),
      },
      {
        // icon: 'i-lucide-heading-3',
        label: 'H3',
        title: 'Heading 3',
        action: () => props.editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => isActive('heading', { level: 3 }),
      },
    ],
  },
  {
    name: 'lists',
    items: [
      {
        icon: 'i-heroicons-list-bullet',
        title: 'Bullet List',
        action: () => props.editor?.chain().focus().toggleBulletList().run(),
        isActive: () => isActive('bulletList'),
      },
      {
        icon: 'i-heroicons-numbered-list',
        title: 'Ordered List',
        action: () => props.editor?.chain().focus().toggleOrderedList().run(),
        isActive: () => isActive('orderedList'),
      },
      {
        icon: 'i-heroicons-clipboard-document-check',
        title: 'Task List',
        action: () => props.editor?.chain().focus().toggleTaskList().run(),
        isActive: () => isActive('taskList'),
      },
    ],
  },
  {
    name: 'insert',
    items: [
      {
        icon: 'i-heroicons-link',
        title: 'Link',
        action: () => emit('insert-link'),
        isActive: () => isActive('link'),
      },
      {
        icon: 'i-heroicons-photo',
        title: 'Image',
        action: () => emit('insert-image'),
      },
      {
        icon: 'i-heroicons-video-camera',
        title: 'YouTube',
        action: () => emit('insert-youtube'),
      },
      {
        icon: 'i-heroicons-table-cells',
        title: 'Table',
        action: () => emit('insert-table'),
      },
      {
        icon: 'i-heroicons-chat-bubble-bottom-center-text',
        title: 'Blockquote',
        action: () => props.editor?.chain().focus().toggleBlockquote().run(),
        isActive: () => isActive('blockquote'),
      },
      {
        icon: 'i-heroicons-minus',
        title: 'Horizontal Rule',
        action: () => props.editor?.chain().focus().setHorizontalRule().run(),
      },
    ],
  },
  {
    name: 'ai',
    items: [
      {
        icon: 'i-heroicons-sparkles',
        title: 'Polish with AI',
        action: () => {
          console.log('Toolbar: Polish button clicked');
          emit('polish');
        },
        color: 'text-purple-600 dark:text-purple-400',
        isLoading: () => props.isPolishing
      }
    ]
  },
  // Table controls - only shown when in a table
  {
    name: 'table',
    items: [
      {
        icon: 'i-heroicons-arrow-left',
        title: 'Add Column Left',
        action: () => props.editor?.chain().focus().addColumnBefore().run(),
        isHidden: () => !isActive('table'),
      },
      {
        icon: 'i-heroicons-arrow-right',
        title: 'Add Column Right',
        action: () => props.editor?.chain().focus().addColumnAfter().run(),
        isHidden: () => !isActive('table'),
      },
      {
        icon: 'i-heroicons-arrow-up',
        title: 'Add Row Before',
        action: () => props.editor?.chain().focus().addRowBefore().run(),
        isHidden: () => !isActive('table'),
      },
      {
        icon: 'i-heroicons-arrow-down',
        title: 'Add Row After',
        action: () => props.editor?.chain().focus().addRowAfter().run(),
        isHidden: () => !isActive('table'),
      },
      {
        icon: 'i-heroicons-table-cells',
        title: 'Delete Column',
        action: () => props.editor?.chain().focus().deleteColumn().run(),
        isHidden: () => !isActive('table'),
        color: 'text-red-600 dark:text-red-400',
      },
      {
        icon: 'i-heroicons-queue-list',
        title: 'Delete Row',
        action: () => props.editor?.chain().focus().deleteRow().run(),
        isHidden: () => !isActive('table'),
        color: 'text-red-600 dark:text-red-400',
      },
      {
        icon: 'i-heroicons-trash',
        title: 'Delete Table',
        action: () => props.editor?.chain().focus().deleteTable().run(),
        isHidden: () => !isActive('table'),
        color: 'text-red-600 dark:text-red-400',
      },
    ],
  },
];
</script>

<template>
  <div
    v-if="editor"
    class="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 backdrop-blur-sm"
  >
    <div v-for="(group, index) in toolbarGroups" :key="group.name" class="flex items-center gap-0.5">
      <!-- Only render group if at least one item is visible -->
      <template v-if="group.items.some(item => !item.isHidden?.())">
        <template v-for="item in group.items" :key="item.title">
          <button
            v-if="!item.isHidden?.()"
            type="button"
            @click="item.action"
            :disabled="item.isLoading?.()"
            class="p-1.5 rounded-md transition-all duration-200 flex items-center justify-center"
            :class="[
              item.isActive?.() 
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' 
                : (item.color || 'text-gray-600 dark:text-gray-400') + ' hover:bg-gray-100 dark:hover:bg-gray-800',
              item.isLoading?.() ? 'opacity-80 cursor-wait pr-2 pl-1.5 gap-1.5 w-auto' : 'min-w-[28px] h-[28px]'
            ]"
            :title="item.title"
          >
            <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4" />
            <span v-else-if="item.label" class="text-xs font-bold">{{ item.label }}</span>
            
            <!-- Spinner -->
            <UIcon 
              v-if="item.isLoading?.()" 
              name="i-heroicons-arrow-path" 
              class="w-3.5 h-3.5 animate-spin text-purple-500 dark:text-purple-400" 
            />
          </button>
        </template>
        
        <!-- Separator -->
        <div v-if="index < toolbarGroups.length - 1 && toolbarGroups.slice(index + 1).some(g => g.items.some(i => !i.isHidden?.()))" class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1.5 flex-shrink-0"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

