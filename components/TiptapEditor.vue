<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
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
}>(), {
  editable: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// Modal states
const showLinkModal = ref(false)
const showImageModal = ref(false)
const linkUrl = ref('')
const imageUrl = ref('')

// Toolbar visibility
const showToolbar = ref(true)

function toggleToolbar() {
  showToolbar.value = !showToolbar.value
}

const editor = useEditor({
  editable: props.editable,
  content: props.modelValue || '',
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: props.placeholder || 'Start writing...'
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer'
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

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="tiptap-editor w-full relative">
    <!-- Toggle Toolbar Button (Floating) -->
    <button
      v-if="editable"
      @click="toggleToolbar"
      class="absolute top-2 right-2 z-20 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-md"
      :class="{ 'top-16': showToolbar }"
      :title="showToolbar ? 'Hide Toolbar (Distraction-free)' : 'Show Toolbar'"
    >
      <UIcon :name="showToolbar ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
    </button>

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
    <EditorContent 
      :editor="editor" 
      class="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none"
    />

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

/* Bold, Italic, etc */
.tiptap-editor .ProseMirror strong {
  font-weight: 700;
}

.tiptap-editor .ProseMirror em {
  font-style: italic;
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
  align-items: flex-start;
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
}

.tiptap-editor .ProseMirror table td,
.tiptap-editor .ProseMirror table th {
  min-width: 1em;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
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
</style>
