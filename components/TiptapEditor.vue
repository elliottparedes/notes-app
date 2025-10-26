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

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return ''
  
  let markdown = html
  
  // STEP 1: Handle complex structures first (before simple tag replacements)
  
  // Convert tables to markdown
  markdown = markdown.replace(/<table[^>]*>(.*?)<\/table>/gis, (match, tableContent) => {
    const rows: string[] = []
    
    // Extract all rows
    const rowMatches = tableContent.match(/<tr[^>]*>.*?<\/tr>/gis) || []
    
    rowMatches.forEach((row: string, index: number) => {
      // Extract cells (both th and td)
      const cellMatches = row.match(/<(th|td)[^>]*>(.*?)<\/(th|td)>/gis) || []
      const cells = cellMatches.map((cell: string) => {
        // Remove cell tags and clean content
        return cell.replace(/<\/?t[hd][^>]*>/gi, '').replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '').trim()
      })
      
      if (cells.length > 0) {
        // Create markdown row
        rows.push('| ' + cells.join(' | ') + ' |')
        
        // Add separator after header row (first row)
        if (index === 0) {
          rows.push('| ' + cells.map(() => '---').join(' | ') + ' |')
        }
      }
    })
    
    return rows.length > 0 ? '\n' + rows.join('\n') + '\n\n' : ''
  })
  
  // Convert code blocks (BEFORE inline code)
  markdown = markdown.replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gis, (match, code) => {
    // Preserve the actual content and decode entities
    const cleanCode = code
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim()
    return '\n```\n' + cleanCode + '\n```\n\n'
  })
  
  // Convert task lists (handle the special data-type="taskList" structure)
  markdown = markdown.replace(/<ul\s+data-type="taskList"[^>]*>(.*?)<\/ul>/gis, (match, listContent) => {
    let taskListMarkdown = '\n'
    
    // Match task items - they can have data-checked before or after data-type
    const taskItems = listContent.match(/<li[^>]*data-type="taskItem"[^>]*>(.*?)<\/li>/gis) || []
    
    taskItems.forEach((item: string) => {
      // Extract the checked state
      const isChecked = /data-checked="true"/.test(item)
      const checkbox = isChecked ? '[x]' : '[ ]'
      
      // Extract content from the complex Tiptap structure
      // Structure: <li ...><label><input...><span></span></label><div><p>content</p></div></li>
      let content = item
        .replace(/<li[^>]*>/gi, '')
        .replace(/<\/li>/gi, '')
        .replace(/<label[^>]*>.*?<\/label>/gis, '') // Remove entire label block
        .replace(/<div[^>]*>/gi, '')
        .replace(/<\/div>/gi, '')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, ' ')
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '')
        .trim()
      
      if (content) {
        taskListMarkdown += `- ${checkbox} ${content}\n`
      }
    })
    
    return taskListMarkdown + '\n'
  })
  
  // STEP 2: Handle standard HTML elements
  markdown = markdown
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    // Blockquotes
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
      const cleaned = content.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n').trim()
      return '\n> ' + cleaned.replace(/\n/g, '\n> ') + '\n\n'
    })
    // Bold and italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Strikethrough
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
    // Inline code (after code blocks)
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    // Regular lists (bullet)
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, listContent) => {
      // Skip if it's a task list (already handled)
      if (match.includes('data-type="taskList"')) return match
      return '\n' + listContent + '\n'
    })
    // Ordered lists
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '\n$1\n')
    // List items (regular)
    .replace(/<li[^>]*>(.*?)<\/li>/gi, (match, content) => {
      // Skip if it's a task item (already handled)
      if (match.includes('data-type="taskItem"')) return ''
      return '- ' + content.trim() + '\n'
    })
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Horizontal rule
    .replace(/<hr\s*\/?>/gi, '\n---\n\n')
  
  // STEP 3: Cleanup
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '')
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
    // Debug: Log the input markdown
    if (markdown.includes('[ ]') || markdown.includes('[x]')) {
      console.log('📝 Input markdown with tasks:', markdown)
    }
    
    // Configure marked to support GFM (GitHub Flavored Markdown) including task lists
    marked.setOptions({
      gfm: true,
      breaks: true,
    })
    
    let html = marked.parse(markdown) as string
    
    // Debug: Log the raw HTML from marked
    if (markdown.includes('[ ]') || markdown.includes('[x]')) {
      console.log('🔄 Marked HTML output:', html)
    }
    if (html.includes('checkbox')) {
      console.log('✅ Found checkbox in HTML')
    }
    
    // Post-process: Convert marked's task list format to Tiptap's format
    // Marked converts "- [ ] task" and "- [x] task" to <input type="checkbox"> inside <li>
    // But Tiptap needs data-type="taskList" and data-type="taskItem" attributes
    
    // Step 1: Find all <ul> that contain task items (inputs with checkboxes)
    html = html.replace(/<ul>\s*([\s\S]*?)<\/ul>/gi, (ulMatch, ulContent) => {
      // Check if this ul contains checkboxes (task list indicators)
      if (/<input[^>]*type="checkbox"/.test(ulContent)) {
        console.log('Found task list, converting...')
        console.log('Original UL content:', ulContent)
        
        // Convert each li with checkbox to taskItem format
        const convertedContent = ulContent.replace(
          /<li>\s*<input\s+([^>]*)type="checkbox"([^>]*)>\s*(.*?)<\/li>/gi,
          (liMatch: string, before: string, after: string, content: string) => {
            // Check if checkbox is checked
            const isChecked = /checked/.test(before + after) ? 'true' : 'false'
            const converted = `<li data-type="taskItem" data-checked="${isChecked}">${content.trim()}</li>`
            console.log('Converted task item:', converted)
            return converted
          }
        )
        
        const result = `<ul data-type="taskList">${convertedContent}</ul>`
        console.log('Final taskList HTML:', result)
        // Return as taskList
        return result
      }
      // Return regular ul unchanged
      return ulMatch
    })
    
    // Debug: Log the final converted HTML
    if (html.includes('taskList')) {
      console.log('Final HTML with taskList:', html)
    }
    
    return html
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
      HTMLAttributes: {
        class: 'task-item-wrapper',
      },
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ],
  content: markdownToHtml(props.modelValue),
  editable: props.editable,
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-6',
    },
  },
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    const markdown = htmlToMarkdown(html)
    
    // Debug: Log task list conversions
    if (html.includes('data-type="taskList"') || html.includes('data-type="taskItem"')) {
      console.log('💾 Saving HTML with taskList:', html)
      console.log('💾 Converted to markdown:', markdown)
    }
    
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

// Watch for changes to editable prop
watch(() => props.editable, (newEditable) => {
  if (editor.value) {
    editor.value.setEditable(newEditable)
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
  <div v-if="editor" class="tiptap-wrapper bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" :class="{ 'editor-locked': !editable }">
    <!-- Toolbar (Hidden when locked) -->
    <div v-if="editable" class="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 flex-wrap">
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

/* Locked editor styles - clean read-only mode */
.tiptap-wrapper.editor-locked {
  background-color: #ffffff !important;
  cursor: default;
  border: none !important;
}

.dark .tiptap-wrapper.editor-locked {
  background-color: #1f2937 !important;
}

.tiptap-wrapper.editor-locked :deep(.ProseMirror) {
  cursor: default;
  user-select: text;
  background-color: #ffffff !important;
}

.dark .tiptap-wrapper.editor-locked :deep(.ProseMirror) {
  background-color: #1f2937 !important;
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
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
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

