<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import type { Level } from '@tiptap/extension-heading'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  editable?: boolean
  showToolbar?: boolean
}>(), {
  editable: true,
  showToolbar: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:showToolbar', value: boolean): void
}>()

// Modal states
const showLinkModal = ref(false)
const showImageModal = ref(false)
const linkUrl = ref('')
const imageUrl = ref('')

// Context menu state
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuSubmenu = ref<string | null>(null)
const submenuButtonRefs = ref<{ [key: string]: HTMLElement | null }>({})

// Toolbar visibility - controlled by parent now
const showToolbar = computed(() => props.showToolbar ?? true)

defineExpose({
  showToolbar
})

const editor = useEditor({
  editable: props.editable,
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6]
      }
    }),
    Underline,
    Placeholder.configure({
      placeholder: props.placeholder || 'Start writing...'
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer'
      },
      // Enable keyboard shortcuts
      addKeyboardShortcuts() {
        return {
          'Mod-k': () => {
            // Trigger the link modal
            const previousUrl = this.editor.getAttributes('link').href
            linkUrl.value = previousUrl || ''
            showLinkModal.value = true
            return true
          }
        }
      }
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex items-start gap-2'
      }
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'border-collapse table-auto w-full my-4'
      }
    }),
    TableRow,
    TableHeader.configure({
      HTMLAttributes: {
        class: 'border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-left font-semibold'
      }
    }),
    TableCell.configure({
      HTMLAttributes: {
        class: 'border border-gray-300 dark:border-gray-600 px-4 py-2'
      }
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-lg my-4'
      }
    })
  ],
  onUpdate: ({ editor }) => {
    // Simply emit the HTML content
    emit('update:modelValue', editor.getHTML())
  }
})

// Watch for external changes to content
watch(() => props.modelValue, (newValue) => {
  if (editor.value && newValue !== editor.value.getHTML()) {
    editor.value.commands.setContent(newValue || '', { emitUpdate: false })
  }
})

// Watch for editable changes
watch(() => props.editable, (newValue) => {
  if (editor.value) {
    editor.value.setEditable(newValue)
  }
})

// Toolbar actions
function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

function toggleUnderline() {
  editor.value?.chain().focus().toggleUnderline().run()
}

function toggleStrike() {
  editor.value?.chain().focus().toggleStrike().run()
}

function toggleCode() {
  editor.value?.chain().focus().toggleCode().run()
}

function toggleHeading(level: Level) {
  editor.value?.chain().focus().toggleHeading({ level }).run()
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

function toggleTaskList() {
  editor.value?.chain().focus().toggleTaskList().run()
}

function toggleCodeBlock() {
  editor.value?.chain().focus().toggleCodeBlock().run()
}

function toggleBlockquote() {
  editor.value?.chain().focus().toggleBlockquote().run()
}

function setLink() {
  // Get current link if editing existing link
  const previousUrl = editor.value?.getAttributes('link').href
  linkUrl.value = previousUrl || ''
  showLinkModal.value = true
}

function confirmLink() {
  if (linkUrl.value.trim()) {
    editor.value?.chain().focus().setLink({ href: linkUrl.value.trim() }).run()
  }
  showLinkModal.value = false
  linkUrl.value = ''
}

function cancelLink() {
  showLinkModal.value = false
  linkUrl.value = ''
}

function unsetLink() {
  editor.value?.chain().focus().unsetLink().run()
}

function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function deleteTable() {
  editor.value?.chain().focus().deleteTable().run()
}

function addColumnBefore() {
  editor.value?.chain().focus().addColumnBefore().run()
}

function addColumnAfter() {
  editor.value?.chain().focus().addColumnAfter().run()
}

function deleteColumn() {
  editor.value?.chain().focus().deleteColumn().run()
}

function addRowBefore() {
  editor.value?.chain().focus().addRowBefore().run()
}

function addRowAfter() {
  editor.value?.chain().focus().addRowAfter().run()
}

function deleteRow() {
  editor.value?.chain().focus().deleteRow().run()
}

function mergeCells() {
  editor.value?.chain().focus().mergeCells().run()
}

function splitCell() {
  editor.value?.chain().focus().splitCell().run()
}

function addImage() {
  imageUrl.value = ''
  showImageModal.value = true
}

function confirmImage() {
  if (imageUrl.value.trim()) {
    editor.value?.chain().focus().setImage({ src: imageUrl.value.trim() }).run()
  }
  showImageModal.value = false
  imageUrl.value = ''
}

function cancelImage() {
  showImageModal.value = false
  imageUrl.value = ''
}

function setHorizontalRule() {
  editor.value?.chain().focus().setHorizontalRule().run()
}

function undo() {
  editor.value?.chain().focus().undo().run()
}

function redo() {
  editor.value?.chain().focus().redo().run()
}

// Context menu handlers
function handleContextMenu(event: MouseEvent) {
  if (!props.editable) return
  
  event.preventDefault()
  
  // Calculate smart position for main menu
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  
  // Estimated main menu height (with all items visible + table options)
  const estimatedMenuHeight = 350 // Approximate height
  const menuWidth = 224 // w-56 in Tailwind = 14 * 16 = 224px
  
  let x = event.clientX
  let y = event.clientY
  
  // Check if menu would overflow bottom
  if (y + estimatedMenuHeight > viewportHeight) {
    // Position from bottom up
    y = Math.max(8, viewportHeight - estimatedMenuHeight - 8)
  }
  
  // Check if menu would overflow right side
  if (x + menuWidth > viewportWidth) {
    // Position from right edge
    x = Math.max(8, viewportWidth - menuWidth - 8)
  }
  
  // Position the context menu at cursor (with adjustments)
  contextMenuPos.value = { x, y }
  
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuSubmenu.value = null
}

function toggleSubmenu(submenu: string) {
  if (contextMenuSubmenu.value === submenu) {
    contextMenuSubmenu.value = null
  } else {
    contextMenuSubmenu.value = submenu
  }
}

// Calculate smart position for submenu
function getSubmenuPosition(buttonKey: string) {
  const button = submenuButtonRefs.value[buttonKey]
  if (!button) return { top: 0, left: 0 }

  const buttonRect = button.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  
  // Estimated submenu height (approximate based on content)
  const estimatedMenuHeight = buttonKey === 'table' ? 280 : 180
  const menuWidth = 208 // 52 * 4 (w-52 in Tailwind)
  const gap = 4
  
  let top = buttonRect.top
  let left = buttonRect.right + gap
  
  // Check if submenu would overflow bottom
  if (top + estimatedMenuHeight > viewportHeight) {
    // Position from bottom up
    top = Math.max(8, viewportHeight - estimatedMenuHeight - 8)
  }
  
  // Check if submenu would overflow right side
  if (left + menuWidth > viewportWidth) {
    // Position to the left of parent menu instead
    left = buttonRect.left - menuWidth - gap
  }
  
  return { top, left }
}

// Close context menu on click outside
onMounted(() => {
  if (process.client) {
    document.addEventListener('click', closeContextMenu)
  }
})

onBeforeUnmount(() => {
  if (process.client) {
    document.removeEventListener('click', closeContextMenu)
  }
  editor.value?.destroy()
})
</script>

<template>
  <div class="tiptap-editor w-full relative">
    <!-- Toolbar (only show when editable) -->
    <Transition name="toolbar">
      <div v-if="editable && showToolbar" class="toolbar sticky top-0 z-10 flex flex-wrap gap-1 p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 rounded-t-lg">
      <!-- Text Formatting -->
      <div class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          @click="toggleBold"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('bold') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Bold (Ctrl+B)"
        >
          <UIcon name="i-heroicons-bold" class="w-5 h-5" />
        </button>
        <button
          @click="toggleItalic"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('italic') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Italic (Ctrl+I)"
        >
          <UIcon name="i-heroicons-italic" class="w-5 h-5" />
        </button>
        <button
          @click="toggleStrike"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('strike') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Strikethrough"
        >
          <UIcon name="i-heroicons-strikethrough" class="w-5 h-5" />
        </button>
        <button
          @click="toggleCode"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('code') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Inline Code"
        >
          <UIcon name="i-heroicons-code-bracket" class="w-5 h-5" />
        </button>
      </div>

      <!-- Headings -->
      <div class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          @click="toggleHeading(1)"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('heading', { level: 1 }) }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-bold"
          title="Heading 1"
        >
          H1
        </button>
        <button
          @click="toggleHeading(2)"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('heading', { level: 2 }) }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-bold"
          title="Heading 2"
        >
          H2
        </button>
        <button
          @click="toggleHeading(3)"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('heading', { level: 3 }) }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-bold"
          title="Heading 3"
        >
          H3
        </button>
      </div>

      <!-- Lists -->
      <div class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          @click="toggleBulletList"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('bulletList') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Bullet List"
        >
          <UIcon name="i-heroicons-list-bullet" class="w-5 h-5" />
        </button>
        <button
          @click="toggleOrderedList"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('orderedList') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Numbered List"
        >
          <UIcon name="i-heroicons-numbered-list" class="w-5 h-5" />
        </button>
        <button
          @click="toggleTaskList"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('taskList') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Task List"
        >
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
        </button>
      </div>

      <!-- Blocks -->
      <div class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          @click="toggleCodeBlock"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('codeBlock') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Code Block"
        >
          <UIcon name="i-heroicons-code-bracket-square" class="w-5 h-5" />
        </button>
        <button
          @click="toggleBlockquote"
          :class="{ 'bg-primary-200 dark:bg-primary-800': editor?.isActive('blockquote') }"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Blockquote"
        >
          <UIcon name="i-heroicons-chat-bubble-left-right" class="w-5 h-5" />
        </button>
      </div>

      <!-- Links & Media -->
      <div class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          v-if="!editor?.isActive('link')"
          @click="setLink"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Add Link"
        >
          <UIcon name="i-heroicons-link" class="w-5 h-5" />
        </button>
        <button
          v-else
          @click="unsetLink"
          class="p-2 rounded bg-primary-200 dark:bg-primary-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Remove Link"
        >
          <UIcon name="i-heroicons-link-slash" class="w-5 h-5" />
        </button>
        <button
          @click="addImage"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Add Image"
        >
          <UIcon name="i-heroicons-photo" class="w-5 h-5" />
        </button>
        <button
          @click="insertTable"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Insert Table"
        >
          <UIcon name="i-heroicons-table-cells" class="w-5 h-5" />
        </button>
      </div>

      <!-- Table Controls (only show when in a table) -->
      <div v-if="editor?.isActive('table')" class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          @click="addColumnBefore"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-semibold"
          title="Add Column Before"
        >
          ← Col
        </button>
        <button
          @click="addColumnAfter"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-semibold"
          title="Add Column After"
        >
          Col →
        </button>
        <button
          @click="deleteColumn"
          class="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors text-xs font-semibold"
          title="Delete Column"
        >
          -Col
        </button>
        <button
          @click="addRowBefore"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-semibold"
          title="Add Row Before"
        >
          ↑ Row
        </button>
        <button
          @click="addRowAfter"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-semibold"
          title="Add Row After"
        >
          Row ↓
        </button>
        <button
          @click="deleteRow"
          class="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors text-xs font-semibold"
          title="Delete Row"
        >
          -Row
        </button>
        <button
          @click="deleteTable"
          class="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
          title="Delete Table"
        >
          <UIcon name="i-heroicons-trash" class="w-5 h-5" />
        </button>
      </div>

      <!-- Misc -->
      <div class="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
        <button
          @click="setHorizontalRule"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Horizontal Rule"
        >
          <UIcon name="i-heroicons-minus" class="w-5 h-5" />
        </button>
      </div>

      <!-- Undo/Redo -->
      <div class="flex gap-1">
        <button
          @click="undo"
          :disabled="!editor?.can().undo()"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <UIcon name="i-heroicons-arrow-uturn-left" class="w-5 h-5" />
        </button>
        <button
          @click="redo"
          :disabled="!editor?.can().redo()"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          <UIcon name="i-heroicons-arrow-uturn-right" class="w-5 h-5" />
        </button>
      </div>
    </div>
    </Transition>

    <!-- Editor Content -->
    <div @contextmenu="handleContextMenu">
      <EditorContent 
        :editor="editor" 
        class="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none"
      />
    </div>

    <!-- Link Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showLinkModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="cancelLink"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelLink"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <UIcon name="i-heroicons-link" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
  </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Insert Link
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter the URL you want to link to
            </p>

            <!-- Input -->
            <input
              v-model="linkUrl"
              type="url"
              placeholder="https://example.com"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
              @keyup.enter="confirmLink"
              autofocus
            />

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="cancelLink"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                block
                @click="confirmLink"
                :disabled="!linkUrl.trim()"
              >
                Insert Link
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Image Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showImageModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="cancelImage"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelImage"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <UIcon name="i-heroicons-photo" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Insert Image
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter the URL of the image you want to insert
            </p>

            <!-- Input -->
            <input
              v-model="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-6"
              @keyup.enter="confirmImage"
              autofocus
            />

            <!-- Preview -->
            <div v-if="imageUrl.trim()" class="mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 p-4">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Preview:</p>
              <img 
                :src="imageUrl" 
                alt="Preview" 
                class="max-w-full h-auto rounded"
                @error="() => {}"
              />
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="cancelImage"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                block
                @click="confirmImage"
                :disabled="!imageUrl.trim()"
              >
                Insert Image
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Context Menu -->
    <Teleport to="body">
      <Transition name="context-menu">
        <div
          v-if="showContextMenu"
          class="fixed z-[9999] w-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1 max-h-[80vh] overflow-y-auto"
          :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
          @click.stop
          @mouseenter="() => {}"
        >
          <!-- Text Formatting -->
          <button
            @click="toggleBold(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('bold') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-bold" class="w-4 h-4" />
            <span class="flex-1 text-left">Bold</span>
            <span class="text-xs text-gray-400">⌘B</span>
          </button>
          <button
            @click="toggleItalic(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('italic') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-italic" class="w-4 h-4" />
            <span class="flex-1 text-left">Italic</span>
            <span class="text-xs text-gray-400">⌘I</span>
          </button>
          <button
            @click="toggleUnderline(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('underline') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-underline" class="w-4 h-4" />
            <span class="flex-1 text-left">Underline</span>
            <span class="text-xs text-gray-400">⌘U</span>
          </button>
          <button
            @click="toggleStrike(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('strike') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-strikethrough" class="w-4 h-4" />
            <span class="flex-1 text-left">Strikethrough</span>
            <span class="text-xs text-gray-400">⌘⇧X</span>
          </button>
          <button
            @click="toggleCode(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('code') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-code-bracket" class="w-4 h-4" />
            <span class="flex-1 text-left">Code</span>
            <span class="text-xs text-gray-400">⌘E</span>
          </button>

          <div class="border-t border-gray-200 dark:border-gray-700 my-1" />

          <!-- Headings Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['headings'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('headings')"
              @click.stop="toggleSubmenu('headings')"
              class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'headings' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <UIcon name="i-heroicons-bars-3-bottom-left" class="w-4 h-4" />
              <span class="flex-1 text-left">Headings</span>
              <UIcon name="i-heroicons-chevron-right" class="w-3 h-3" />
            </button>
          </div>

          <!-- Lists Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['lists'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('lists')"
              @click.stop="toggleSubmenu('lists')"
              class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'lists' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
              <span class="flex-1 text-left">Lists</span>
              <UIcon name="i-heroicons-chevron-right" class="w-3 h-3" />
            </button>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 my-1" />

          <!-- Insert Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['insert'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('insert')"
              @click.stop="toggleSubmenu('insert')"
              class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'insert' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
              <span class="flex-1 text-left">Insert</span>
              <UIcon name="i-heroicons-chevron-right" class="w-3 h-3" />
            </button>
          </div>

          <!-- Table Controls (only show when in a table) -->
          <template v-if="editor?.isActive('table')">
            <div class="border-t border-gray-200 dark:border-gray-700 my-1" />
            <div class="relative">
              <button
                :ref="el => submenuButtonRefs['table'] = el as HTMLElement"
                @mouseenter="toggleSubmenu('table')"
                @click.stop="toggleSubmenu('table')"
                class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-medium"
                :class="contextMenuSubmenu === 'table' ? 'bg-primary-100 dark:bg-primary-900/30' : ''"
              >
                <UIcon name="i-heroicons-table-cells" class="w-4 h-4" />
                <span class="flex-1 text-left">Table Options</span>
                <UIcon name="i-heroicons-chevron-right" class="w-3 h-3" />
              </button>
            </div>
          </template>
        </div>
      </Transition>

      <!-- Flyout Submenus -->
      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'headings' && submenuButtonRefs['headings']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{
            top: `${getSubmenuPosition('headings').top}px`,
            left: `${getSubmenuPosition('headings').left}px`
          }"
          @click.stop
        >
          <button
            @click="toggleHeading(1); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('heading', { level: 1 }) ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <span class="font-bold text-xs w-6">H1</span>
            <span class="flex-1 text-left">Heading 1</span>
            <span class="text-xs text-gray-400">⌘⌥1</span>
          </button>
          <button
            @click="toggleHeading(2); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('heading', { level: 2 }) ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <span class="font-bold text-xs w-6">H2</span>
            <span class="flex-1 text-left">Heading 2</span>
            <span class="text-xs text-gray-400">⌘⌥2</span>
          </button>
          <button
            @click="toggleHeading(3); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('heading', { level: 3 }) ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <span class="font-bold text-xs w-6">H3</span>
            <span class="flex-1 text-left">Heading 3</span>
            <span class="text-xs text-gray-400">⌘⌥3</span>
          </button>
        </div>
      </Transition>

      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'lists' && submenuButtonRefs['lists']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{
            top: `${getSubmenuPosition('lists').top}px`,
            left: `${getSubmenuPosition('lists').left}px`
          }"
          @click.stop
        >
          <button
            @click="toggleBulletList(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('bulletList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
            <span class="flex-1 text-left">Bullet List</span>
            <span class="text-xs text-gray-400">⌘⇧8</span>
          </button>
          <button
            @click="toggleOrderedList(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('orderedList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-numbered-list" class="w-4 h-4" />
            <span class="flex-1 text-left">Numbered List</span>
            <span class="text-xs text-gray-400">⌘⇧7</span>
          </button>
          <button
            @click="toggleTaskList(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('taskList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span class="flex-1 text-left">Task List</span>
            <span class="text-xs text-gray-400">⌘⇧9</span>
          </button>
        </div>
      </Transition>

      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'insert' && submenuButtonRefs['insert']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{
            top: `${getSubmenuPosition('insert').top}px`,
            left: `${getSubmenuPosition('insert').left}px`
          }"
          @click.stop
        >
          <button
            @click="setLink(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-link" class="w-4 h-4" />
            <span class="flex-1 text-left">Link</span>
            <span class="text-xs text-gray-400">⌘K</span>
          </button>
          <button
            @click="addImage(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-photo" class="w-4 h-4" />
            <span class="flex-1 text-left">Image</span>
          </button>
          <button
            @click="insertTable(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-table-cells" class="w-4 h-4" />
            <span class="flex-1 text-left">Table</span>
          </button>
          <button
            @click="toggleCodeBlock(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-code-bracket-square" class="w-4 h-4" />
            <span class="flex-1 text-left">Code Block</span>
            <span class="text-xs text-gray-400">⌘⌥C</span>
          </button>
        </div>
      </Transition>

      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'table' && submenuButtonRefs['table']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{
            top: `${getSubmenuPosition('table').top}px`,
            left: `${getSubmenuPosition('table').left}px`
          }"
          @click.stop
        >
          <button
            @click="addRowBefore(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-arrow-up" class="w-4 h-4" />
            <span class="flex-1 text-left">Add Row Above</span>
          </button>
          <button
            @click="addRowAfter(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-arrow-down" class="w-4 h-4" />
            <span class="flex-1 text-left">Add Row Below</span>
          </button>
          <button
            @click="addColumnBefore(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
            <span class="flex-1 text-left">Add Column Left</span>
          </button>
          <button
            @click="addColumnAfter(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
            <span class="flex-1 text-left">Add Column Right</span>
          </button>
          <div class="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            @click="deleteRow(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
          >
            <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            <span class="flex-1 text-left">Delete Row</span>
          </button>
          <button
            @click="deleteColumn(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
          >
            <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            <span class="flex-1 text-left">Delete Column</span>
          </button>
          <button
            @click="deleteTable(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
          >
            <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            <span class="flex-1 text-left">Delete Table</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* Tiptap Editor Styles */
.tiptap-editor .ProseMirror {
  outline: none;
  min-height: 400px;
}

.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Heading Styles */
.tiptap-editor .ProseMirror h1 {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 2.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
}

.tiptap-editor .ProseMirror h2 {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 2.25rem;
  margin-top: 1.5rem;
  margin-bottom: 0.875rem;
}

.tiptap-editor .ProseMirror h3 {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 2rem;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}

.tiptap-editor .ProseMirror h4 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.75rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.tiptap-editor .ProseMirror h5 {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.75rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.tiptap-editor .ProseMirror h6 {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5rem;
  margin-top: 0.875rem;
  margin-bottom: 0.5rem;
}

/* Paragraph Styles */
.tiptap-editor .ProseMirror p {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  line-height: 1.75;
}

/* List Styles */
.tiptap-editor .ProseMirror ul,
.tiptap-editor .ProseMirror ol {
  padding-left: 1.625rem;
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}

.tiptap-editor .ProseMirror ul {
  list-style-type: disc;
}

.tiptap-editor .ProseMirror ol {
  list-style-type: decimal;
}

.tiptap-editor .ProseMirror li {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.tiptap-editor .ProseMirror ul ul,
.tiptap-editor .ProseMirror ol ul {
  list-style-type: circle;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.tiptap-editor .ProseMirror ul ul ul,
.tiptap-editor .ProseMirror ol ul ul {
  list-style-type: square;
}

/* Bold, Italic, Underline, etc */
.tiptap-editor .ProseMirror strong {
  font-weight: 700;
}

.tiptap-editor .ProseMirror em {
  font-style: italic;
}

.tiptap-editor .ProseMirror u {
  text-decoration: underline;
}

.tiptap-editor .ProseMirror code {
  background-color: #f3f4f6;
  color: #ef4444;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: monospace;
}

.dark .tiptap-editor .ProseMirror code {
  background-color: #374151;
  color: #fca5a5;
}

.tiptap-editor .ProseMirror s {
  text-decoration: line-through;
}

/* Task list styles */
.tiptap-editor ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}

.tiptap-editor ul[data-type="taskList"] li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tiptap-editor ul[data-type="taskList"] li > label {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
}

.tiptap-editor ul[data-type="taskList"] li > div {
  flex: 1 1 auto;
}

/* Code block styles */
.tiptap-editor pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}

.tiptap-editor pre code {
  background: none;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Blockquote styles */
.tiptap-editor .ProseMirror blockquote {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
  color: #6b7280;
}

.dark .tiptap-editor .ProseMirror blockquote {
  color: #9ca3af;
}

/* Horizontal Rule */
.tiptap-editor .ProseMirror hr {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 2rem 0;
}

.dark .tiptap-editor .ProseMirror hr {
  border-top-color: #374151;
}

/* Link styles */
.tiptap-editor .ProseMirror a {
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
}

.dark .tiptap-editor .ProseMirror a {
  color: #60a5fa;
}

/* Table styles */
.tiptap-editor .ProseMirror table {
  border-collapse: collapse;
  table-layout: auto;
  width: 100%;
  margin: 1rem 0;
  overflow: hidden;
  display: block;
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

/* Reset table to standard display for tbody, thead, etc */
.tiptap-editor .ProseMirror table tbody,
.tiptap-editor .ProseMirror table thead {
  display: table-row-group;
}

.tiptap-editor .ProseMirror table tr {
  display: table-row;
}

.tiptap-editor .ProseMirror table td,
.tiptap-editor .ProseMirror table th {
  display: table-cell;
  min-width: 1em;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
  white-space: normal;
}

.dark .tiptap-editor .ProseMirror table td,
.dark .tiptap-editor .ProseMirror table th {
  border-color: #4b5563;
}

.tiptap-editor .ProseMirror table th {
  background-color: #f3f4f6;
  font-weight: 600;
  text-align: left;
}

.dark .tiptap-editor .ProseMirror table th {
  background-color: #1f2937;
}

/* Ensure proper spacing in read-only mode */
.tiptap-editor .ProseMirror[contenteditable="false"] {
  cursor: default;
}

/* Toolbar transition */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.3s ease;
}

.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  overflow: hidden;
}

.toolbar-enter-to,
.toolbar-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 500px;
}

/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: all 0.3s ease;
}

.modal-enter-from > div:first-child,
.modal-leave-to > div:first-child {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

/* Context menu animation */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.15s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.context-menu-enter-to,
.context-menu-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}
</style>
