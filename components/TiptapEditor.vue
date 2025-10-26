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
import { marked } from 'marked'
import type { Level } from '@tiptap/extension-heading'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return ''
  
  // Basic HTML to Markdown conversion
  let markdown = html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    // Bold and italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Strikethrough
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
    // Code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n\n')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '\n$1\n')
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '\n$1\n')
    // Blockquotes
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
      return '\n> ' + content.trim().replace(/\n/g, '\n> ') + '\n\n'
    })
    // Task lists
    .replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi, '- [x] $1\n')
    .replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi, '- [ ] $1\n')
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Horizontal rule
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    // Clean up extra newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  
  return markdown
}

// Convert markdown to HTML for display
const markdownToHtml = (markdown: string): string => {
  if (!markdown) return ''
  try {
    return marked.parse(markdown) as string
  } catch (error) {
    console.error('Markdown parse error:', error)
    return markdown
  }
}

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder || 'Start writing...',
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary-600 dark:text-primary-400 underline hover:text-primary-700 dark:hover:text-primary-300',
      },
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-lg',
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ],
  content: markdownToHtml(props.modelValue),
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-6',
    },
  },
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    const markdown = htmlToMarkdown(html)
    emit('update:modelValue', markdown)
  },
})

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  if (editor.value) {
    const currentMarkdown = htmlToMarkdown(editor.value.getHTML())
    if (currentMarkdown !== newValue) {
      editor.value.commands.setContent(markdownToHtml(newValue))
    }
  }
})

// Toolbar actions
const setLink = () => {
  const url = window.prompt('Enter URL')
  if (url) {
    editor.value?.chain().focus().setLink({ href: url }).run()
  }
}

const addImage = () => {
  const url = window.prompt('Enter image URL')
  if (url) {
    editor.value?.chain().focus().setImage({ src: url }).run()
  }
}

const addTable = () => {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div v-if="editor" class="tiptap-wrapper bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 flex-wrap">
      <!-- Text Style -->
      <div class="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2">
        <button
          v-for="level in [1, 2, 3] as Level[]"
          :key="level"
          @click="editor.chain().focus().toggleHeading({ level }).run()"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('heading', { level }) }"
          class="px-2 py-1.5 text-sm font-medium rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          H{{ level }}
        </button>
      </div>

      <!-- Formatting -->
      <div class="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2">
        <button
          @click="editor.chain().focus().toggleBulletList().run()"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('bulletList') }"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Bullet List"
        >
          <UIcon name="i-heroicons-list-bullet" class="w-5 h-5" />
        </button>
        <button
          @click="editor.chain().focus().toggleOrderedList().run()"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('orderedList') }"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Numbered List"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            <text x="2" y="8" font-size="8" fill="currentColor">1</text>
            <text x="2" y="14" font-size="8" fill="currentColor">2</text>
            <text x="2" y="20" font-size="8" fill="currentColor">3</text>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleTaskList().run()"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('taskList') }"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Task List"
        >
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
        </button>
      </div>

      <!-- Insert -->
      <div class="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2">
        <button
          @click="addImage"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Insert Image"
        >
          <UIcon name="i-heroicons-photo" class="w-5 h-5" />
        </button>
        <button
          @click="editor.chain().focus().toggleBlockquote().run()"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('blockquote') }"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Quote"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleCodeBlock().run()"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('codeBlock') }"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Code Block"
        >
          <UIcon name="i-heroicons-code-bracket" class="w-5 h-5" />
        </button>
        <button
          @click="addTable"
          :class="{ 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400': editor.isActive('table') }"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Insert Table"
        >
          <UIcon name="i-heroicons-table-cells" class="w-5 h-5" />
        </button>
        <button
          @click="editor.chain().focus().setHorizontalRule().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Horizontal Rule"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12h16" />
          </svg>
        </button>
      </div>

      <!-- Table Controls (only show when inside a table) -->
      <div v-if="editor.isActive('table')" class="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2">
        <button
          @click="editor.chain().focus().addColumnBefore().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
          title="Add Column Before"
        >
          ← Col
        </button>
        <button
          @click="editor.chain().focus().addColumnAfter().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
          title="Add Column After"
        >
          Col →
        </button>
        <button
          @click="editor.chain().focus().deleteColumn().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium text-red-600"
          title="Delete Column"
        >
          − Col
        </button>
        <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button
          @click="editor.chain().focus().addRowBefore().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
          title="Add Row Before"
        >
          ↑ Row
        </button>
        <button
          @click="editor.chain().focus().addRowAfter().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
          title="Add Row After"
        >
          Row ↓
        </button>
        <button
          @click="editor.chain().focus().deleteRow().run()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium text-red-600"
          title="Delete Row"
        >
          − Row
        </button>
        <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button
          @click="editor.chain().focus().deleteTable().run()"
          class="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-medium text-red-600"
          title="Delete Table"
        >
          <UIcon name="i-heroicons-trash" class="w-4 h-4" />
        </button>
      </div>

      <!-- Undo/Redo -->
      <div class="flex items-center gap-1">
        <button
          @click="editor.chain().focus().undo().run()"
          :disabled="!editor.can().undo()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
        >
          <UIcon name="i-heroicons-arrow-uturn-left" class="w-5 h-5" />
        </button>
        <button
          @click="editor.chain().focus().redo().run()"
          :disabled="!editor.can().redo()"
          class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
        >
          <UIcon name="i-heroicons-arrow-uturn-right" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Editor Content -->
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
/* TipTap Editor Styles */
.tiptap-wrapper :deep(.ProseMirror) {
  min-height: 400px;
  outline: none;
}

.tiptap-wrapper :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

.tiptap-wrapper :deep(.ProseMirror h1) {
  font-size: 2.25rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
}

.tiptap-wrapper :deep(.ProseMirror h2) {
  font-size: 1.875rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}

.tiptap-wrapper :deep(.ProseMirror h3) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.tiptap-wrapper :deep(.ProseMirror h4) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
}

.tiptap-wrapper :deep(.ProseMirror h5) {
  font-size: 1.125rem;
  font-weight: 700;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.tiptap-wrapper :deep(.ProseMirror h6) {
  font-size: 1rem;
  font-weight: 700;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.tiptap-wrapper :deep(.ProseMirror ul),
.tiptap-wrapper :deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.tiptap-wrapper :deep(.ProseMirror ul) {
  list-style-type: disc;
}

.tiptap-wrapper :deep(.ProseMirror ol) {
  list-style-type: decimal;
}

.tiptap-wrapper :deep(.ProseMirror li) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.tiptap-wrapper :deep(.ProseMirror code) {
  background-color: #f3f4f6;
  color: #2563eb;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.dark .tiptap-wrapper :deep(.ProseMirror code) {
  background-color: #1f2937;
  color: #60a5fa;
}

.tiptap-wrapper :deep(.ProseMirror pre) {
  background-color: #111827;
  color: #f3f4f6;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.dark .tiptap-wrapper :deep(.ProseMirror pre) {
  background-color: #000000;
}

.tiptap-wrapper :deep(.ProseMirror pre code) {
  background-color: transparent;
  color: #f3f4f6;
  padding: 0;
}

.tiptap-wrapper :deep(.ProseMirror blockquote) {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  font-style: italic;
  margin-top: 1rem;
  margin-bottom: 1rem;
  color: #4b5563;
}

.dark .tiptap-wrapper :deep(.ProseMirror blockquote) {
  color: #9ca3af;
}

.tiptap-wrapper :deep(.ProseMirror hr) {
  border-top: 2px solid #d1d5db;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}

.dark .tiptap-wrapper :deep(.ProseMirror hr) {
  border-top-color: #4b5563;
}

.tiptap-wrapper :deep(.ProseMirror a) {
  color: #2563eb;
  text-decoration: underline;
}

.tiptap-wrapper :deep(.ProseMirror a:hover) {
  color: #1d4ed8;
}

.dark .tiptap-wrapper :deep(.ProseMirror a) {
  color: #60a5fa;
}

.dark .tiptap-wrapper :deep(.ProseMirror a:hover) {
  color: #93c5fd;
}

/* Images */
.tiptap-wrapper :deep(.ProseMirror img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
  display: block;
  cursor: default;
}

.tiptap-wrapper :deep(.ProseMirror img.ProseMirror-selectednode) {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}

.dark .tiptap-wrapper :deep(.ProseMirror img.ProseMirror-selectednode) {
  outline-color: #60a5fa;
}

.tiptap-wrapper :deep(.ProseMirror ul[data-type="taskList"]) {
  list-style-type: none;
  padding-left: 0;
}

.tiptap-wrapper :deep(.ProseMirror ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.tiptap-wrapper :deep(.ProseMirror ul[data-type="taskList"] li input[type="checkbox"]) {
  margin-top: 0.25rem;
  border-radius: 0.25rem;
  border-color: #d1d5db;
  color: #2563eb;
}

.dark .tiptap-wrapper :deep(.ProseMirror ul[data-type="taskList"] li input[type="checkbox"]) {
  border-color: #4b5563;
}

.tiptap-wrapper :deep(.ProseMirror ul[data-type="taskList"] li input[type="checkbox"]:focus) {
  ring-color: #3b82f6;
}

.tiptap-wrapper :deep(.ProseMirror table) {
  border-collapse: collapse;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.tiptap-wrapper :deep(.ProseMirror th),
.tiptap-wrapper :deep(.ProseMirror td) {
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
}

.dark .tiptap-wrapper :deep(.ProseMirror th),
.dark .tiptap-wrapper :deep(.ProseMirror td) {
  border-color: #4b5563;
}

.tiptap-wrapper :deep(.ProseMirror th) {
  background-color: #f3f4f6;
  font-weight: 700;
}

.dark .tiptap-wrapper :deep(.ProseMirror th) {
  background-color: #1f2937;
}
</style>

