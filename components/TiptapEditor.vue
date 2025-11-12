<script setup lang="ts">
import { nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import Gapcursor from '@tiptap/extension-gapcursor'
import { Extension, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { DOMParser } from 'prosemirror-model'
import { inputRules } from '@tiptap/pm/inputrules'
import type { Level } from '@tiptap/extension-heading'
import { YouTube } from './YouTubeExtension'

// Global callback for slash command (accessible from plugin)
let slashCommandCallback: (() => void) | null = null

// Helper function to process inline markdown formatting
function processInlineMarkdown(text: string): string {
  let processed = text
  
  // Bold **text** or __text__
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  
  // Italic *text* or _text_ (but not if it's part of bold)
  processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  processed = processed.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
  
  // Strikethrough ~~text~~
  processed = processed.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  
  // Inline code `code`
  processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Links [text](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  
  return processed
}

// Helper function to convert markdown to HTML
function markdownToHTML(text: string): string {
  const markdownPatterns = [
    /^#{1,6}\s+.+$/m,           // Headings (# ## ###)
    /^[-*+]\s+.+$/m,            // Bullet lists
    /^\d+\.\s+.+$/m,            // Numbered lists
    /^>\s+.+$/m,                // Blockquotes
    /^---$/m,                   // Horizontal rules
    /^```[\s\S]*?```$/m,        // Code blocks
    /`[^`]+`/g,                 // Inline code
    /\*\*[^*]+\*\*/g,           // Bold
    /\*[^*]+\*/g,               // Italic
    /__[^_]+__/g,               // Bold (underscore)
    /_[^_]+_/g,                 // Italic (underscore)
    /~~[^~]+~~/g,               // Strikethrough
    /\[([^\]]+)\]\(([^)]+)\)/g  // Links
  ]
  
  const isMarkdown = markdownPatterns.some(pattern => pattern.test(text))
  
  if (!isMarkdown || !text.trim()) {
    return text // Return as-is if not markdown
  }
  
  // Convert markdown to HTML
  const lines = text.split('\n')
  const processedLines: string[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  
  lines.forEach((line) => {
    const trimmedLine = line.trim()
    
    // Code blocks
    if (trimmedLine.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const codeContent = codeBlockContent.join('\n')
        processedLines.push(`<pre><code>${codeContent}</code></pre>`)
        codeBlockContent = []
        inCodeBlock = false
      } else {
        // Start code block
        inCodeBlock = true
      }
      return
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line)
      return
    }
    
    // Horizontal rules (--- or ***) - check before lists to avoid conflicts
    if (trimmedLine.match(/^[-*]{3,}$/)) {
      processedLines.push('<hr>')
      return
    }
    
    // Headings
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length
      const content = headingMatch[2]
      if (level <= 3) {
        processedLines.push(`<h${level}>${content}</h${level}>`)
      } else {
        processedLines.push(`<p>${trimmedLine}</p>`)
      }
      return
    }
    
    // Bullet lists
    const bulletMatch = trimmedLine.match(/^[-*+]\s+(.+)$/)
    if (bulletMatch && bulletMatch[1]) {
      let content = bulletMatch[1]
      // Process inline markdown formatting within list items
      content = processInlineMarkdown(content)
      processedLines.push(`<ul><li>${content}</li></ul>`)
      return
    }
    
    // Numbered lists
    const orderedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch && orderedMatch[1]) {
      let content = orderedMatch[1]
      // Process inline markdown formatting within list items
      content = processInlineMarkdown(content)
      processedLines.push(`<ol><li>${content}</li></ol>`)
      return
    }
    
    // Blockquotes
    // Match `> content` (ignore empty `>` lines)
    if (trimmedLine.startsWith('>')) {
      // Remove the `>` prefix
      const content = trimmedLine.slice(1).trim()
      if (content) {
        // Process inline markdown formatting within blockquotes
        const processedContent = processInlineMarkdown(content)
        processedLines.push(`<blockquote><p>${processedContent}</p></blockquote>`)
      }
      // If empty (just `>`), skip it - don't create empty blockquote
      return
    }
    
    // Regular paragraph with inline markdown
    if (trimmedLine) {
      let processedLine = processInlineMarkdown(trimmedLine)
      processedLines.push(`<p>${processedLine}</p>`)
    } else {
      processedLines.push('<p></p>')
    }
  })
  
  // Handle any remaining code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    const codeContent = codeBlockContent.join('\n')
    processedLines.push(`<pre><code>${codeContent}</code></pre>`)
  }
  
  return processedLines.join('\n')
}

// Store editor reference for markdown paste
let editorInstanceForPaste: any = null

// Custom extension for markdown paste support
const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event, slice) => {
            const text = event.clipboardData?.getData('text/plain') || ''
            const html = event.clipboardData?.getData('text/html') || ''
            
            // If HTML is already present and looks like valid HTML, use TipTap's insertContent
            if (html && html.includes('<') && html.match(/<[a-z][\s\S]*>/i)) {
              // Use TipTap's insertContent which properly parses HTML
              if (editorInstanceForPaste && editorInstanceForPaste.commands) {
                // Clean up the HTML - remove any wrapper elements browsers add
                let cleanHTML = html
                // Remove common browser wrapper elements
                cleanHTML = cleanHTML.replace(/^<html[^>]*>[\s\S]*<body[^>]*>/i, '')
                cleanHTML = cleanHTML.replace(/<\/body>[\s\S]*<\/html>$/i, '')
                cleanHTML = cleanHTML.replace(/^<!--StartFragment-->/, '')
                cleanHTML = cleanHTML.replace(/<!--EndFragment-->$/, '')
                
                editorInstanceForPaste.chain().focus().deleteSelection().insertContent(cleanHTML).run()
                return true
              }
              return false
            }
            
            if (!text.trim()) {
              return false
            }
            
            // Convert markdown to HTML
            const convertedHTML = markdownToHTML(text)
            
            // If HTML is different from text, it means markdown was converted
            if (convertedHTML !== text) {
              // Use TipTap's insertContent which properly parses HTML
              if (editorInstanceForPaste && editorInstanceForPaste.commands) {
                editorInstanceForPaste.chain().focus().deleteSelection().insertContent(convertedHTML).run()
                return true
              }
            }
            
            return false
          }
        }
      })
    ]
  }
})

// Custom extension for slash commands (formatting menu) - Notion style
const SlashCommand = Extension.create({
  name: 'slashCommand',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('slashCommand'),
        props: {
          handleKeyDown: (view, event) => {
            // Only handle "/" key
            if (event.key !== '/') {
              return false
            }
            
            // Don't trigger in code blocks
            const { state } = view
            const { $from } = state.selection
            for (let d = $from.depth; d > 0; d--) {
              if ($from.node(d).type.name === 'codeBlock') {
                return false
              }
            }
            
            // Call the callback if it exists
            if (slashCommandCallback) {
              console.log('[SlashCommand] "/" key pressed, triggering menu')
              event.preventDefault()
              slashCommandCallback()
              return true
            } else {
              console.log('[SlashCommand] "/" key pressed but callback not set')
            }
            
            return false
          }
        }
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      '/': ({ editor }) => {
        // Don't trigger in code blocks
        if (editor.isActive('codeBlock')) {
          return false
        }
        
        if (slashCommandCallback) {
          slashCommandCallback()
          return true // Prevent "/" from being inserted
        }
        return false
      }
    }
  }
})

// Custom extension to handle table exit
const TableExit = Extension.create({
  name: 'tableExit',

  addKeyboardShortcuts() {
    return {
      // Exit table when pressing Mod-Enter (Cmd/Ctrl+Enter) in a table cell
      'Mod-Enter': ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        
        // Check if we're in a table
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            // We're in a table, insert a paragraph after it
            const tablePos = $from.before(d)
            const table = $from.node(d)
            const afterTablePos = tablePos + table.nodeSize
            
            editor.chain()
              .insertContentAt(afterTablePos, { type: 'paragraph' })
              .setTextSelection(afterTablePos + 1)
              .run()
            
            return true
          }
        }
        return false
      },
      // Also handle Tab in last cell
      'Tab': ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        
        // Check if we're in a table
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            // Try to go to next cell first (default Tab behavior)
            const went = editor.commands.goToNextCell()
            if (!went) {
              // If no next cell, we're in the last cell - create paragraph after table
              const tablePos = $from.before(d)
              const table = $from.node(d)
              const afterTablePos = tablePos + table.nodeSize
              
              editor.chain()
                .insertContentAt(afterTablePos, { type: 'paragraph' })
                .setTextSelection(afterTablePos + 1)
                .run()
              
              return true
            }
            return true
          }
        }
        return false
      }
    }
  }
})


// Custom TaskItem extension that applies strike formatting when checked
const TaskItemWithStrike = TaskItem.extend({
  addInputRules() {
    // Get parent input rules first
    const parentRules = this.parent?.() || []
    console.log('[TaskItem] Parent input rules:', parentRules.length)
    
    // Add a rule that matches [] without requiring a space
    // This ensures [] creates a TaskList, not BulletList
    const customRule = {
      // Match [] or [ ] or [x] with optional space after
      // This must come BEFORE BulletList rules to take precedence
      find: /\s*\[([ x])\]\s?$/,
      handler: ({ state, range, match, chain }) => {
        console.log('[TaskItem] Input rule MATCHED! Pattern: []', 'Match:', match, 'Range:', range)
        const checked = match[1] === 'x'
        console.log('[TaskItem] Creating task item, checked:', checked)
        return chain()
          .deleteRange({ from: range.from, to: range.to })
          .command(({ tr, dispatch }) => {
            console.log('[TaskItem] Command handler called, dispatch:', dispatch)
            if (dispatch) {
              // Check if we're already in a task list
              const $from = tr.doc.resolve(range.from)
              let inTaskList = false
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === 'taskList') {
                  inTaskList = true
                  console.log('[TaskItem] Already in task list')
                  break
                }
              }
              
              if (!inTaskList) {
                // Create task list with task item
                const taskListType = state.schema.nodes.taskList
                const taskItemType = state.schema.nodes.taskItem
                console.log('[TaskItem] Creating new task list. Types available:', !!taskListType, !!taskItemType)
                if (taskListType && taskItemType) {
                  const taskItem = taskItemType.create({ checked })
                  const taskList = taskListType.create(null, taskItem)
                  tr.replaceWith(range.from, range.from, taskList)
                  const newPos = range.from + taskList.nodeSize - 1
                  tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)))
                  console.log('[TaskItem] Created task list with task item at pos:', range.from)
                }
              } else {
                // Already in task list, just create task item
                const taskItemType = state.schema.nodes.taskItem
                if (taskItemType) {
                  const taskItem = taskItemType.create({ checked })
                  tr.replaceWith(range.from, range.from, taskItem)
                  const newPos = range.from + taskItem.nodeSize - 1
                  tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)))
                  console.log('[TaskItem] Created task item in existing list at pos:', range.from)
                }
              }
            }
            return true
          })
          .run()
      }
    }
    
    console.log('[TaskItem] Returning input rules:', [...parentRules, customRule].length)
    return [
      ...parentRules,
      customRule
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('taskItemStrike'),
        appendTransaction(transactions, oldState, newState) {
          // Only process if the document actually changed
          if (!transactions.some(tr => tr.docChanged)) {
            return null
          }

          // Skip if this looks like a complete document replacement (e.g., switching notes)
          // Check if the document sizes are very different or if it's a setContent operation
          const isCompleteReplacement = 
            Math.abs(oldState.doc.content.size - newState.doc.content.size) > oldState.doc.content.size * 0.5 ||
            transactions.some(tr => tr.getMeta('addToHistory') === false && tr.steps.length > 0);

          if (isCompleteReplacement) {
            return null
          }

          const tr = newState.tr
          let modified = false

          // Iterate through all task items to check for checked state changes
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'taskItem') {
              const isChecked = node.attrs.checked
              
              // Safely check if position exists in old document
              let wasChecked = false
              if (pos >= 0 && pos < oldState.doc.content.size) {
                try {
                  const oldNode = oldState.doc.nodeAt(pos)
                  if (oldNode && oldNode.type.name === 'taskItem') {
                    wasChecked = oldNode.attrs.checked || false
                  }
                } catch (e) {
                  // Position doesn't exist in old document, assume unchecked
                  wasChecked = false
                }
              }

              // If checked state changed, apply or remove strike formatting
              if (isChecked !== wasChecked) {
                // Find all text nodes within the task item and apply/remove strike
                // The task item content starts after the checkbox (pos + 1)
                const contentStart = pos + 1
                const contentEnd = pos + node.nodeSize - 1

                try {
                  newState.doc.nodesBetween(contentStart, contentEnd, (textNode, textPos) => {
                    if (textNode.isText && textPos >= 0 && textPos + textNode.nodeSize <= newState.doc.content.size) {
                      // Check if strike mark exists
                      const hasStrike = textNode.marks.some(mark => mark.type.name === 'strike')
                      const strikeMarkType = newState.schema.marks.strike
                      
                      if (!strikeMarkType) {
                        return // Strike mark type not available
                      }
                      
                      if (isChecked && !hasStrike) {
                        // Apply strike formatting to this text node
                        const strikeMark = strikeMarkType.create()
                        tr.addMark(textPos, textPos + textNode.nodeSize, strikeMark)
                        modified = true
                      } else if (!isChecked && hasStrike) {
                        // Remove strike formatting from this text node
                        const strikeMark = textNode.marks.find(mark => mark.type.name === 'strike')
                        if (strikeMark) {
                          tr.removeMark(textPos, textPos + textNode.nodeSize, strikeMark)
                          modified = true
                        }
                      }
                    }
                  })
                } catch (e) {
                  // Skip this task item if there's an error accessing positions
                  console.warn('[TiptapEditor] Error processing task item strike:', e)
                }
              }
            }
          })

          return modified ? tr : null
        }
      })
    ]
  }
})

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  editable?: boolean
  showToolbar?: boolean
  noteId?: string // Note ID for file uploads
  onAttachmentUpload?: (attachment: any) => void | Promise<void>
}>(), {
  editable: true,
  showToolbar: true,
  noteId: undefined,
  onAttachmentUpload: undefined
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:showToolbar', value: boolean): void
  (e: 'attachment-uploaded', attachment: { id: number; file_name: string; file_path: string; mime_type: string | null; presigned_url?: string }): void
  (e: 'attachmentUploaded', attachment: { id: number; file_name: string; file_path: string; mime_type: string | null; presigned_url?: string }): void
}>()

// Modal states
const showLinkModal = ref(false)
const showImageModal = ref(false)
const showYouTubeModal = ref(false)
const linkUrl = ref('')
const imageUrl = ref('')
const youtubeUrl = ref('')

// Context menu state
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuSubmenu = ref<string | null>(null)
const submenuButtonRefs = ref<{ [key: string]: HTMLElement | null }>({})

// File upload state
const fileInputRef = ref<HTMLInputElement | null>(null)
const isUploadingFile = ref(false)

// Toolbar visibility - controlled by parent now
const showToolbar = computed(() => props.showToolbar ?? true)

// Expose methods for parent components to access editor content
function getHTML(): string {
  return editor.value?.getHTML() || ''
}

defineExpose({
  showToolbar,
  getHTML
})

const editor = useEditor({
  editable: props.editable,
  content: props.modelValue || '',
  onBeforeCreate: ({ editor }) => {
    console.log('[Editor] onBeforeCreate - extensions being set up')
  },
  onCreate: ({ editor }) => {
    console.log('[Editor] onCreate - editor created')
    console.log('[Editor] Extensions:', editor.extensionManager.extensions.map(ext => ext.name))
    const inputRules = editor.extensionManager.extensions
      .filter(ext => ext.name === 'taskItem' || ext.name === 'bulletList')
      .map(ext => ({
        name: ext.name,
        inputRules: ext.options.inputRules || []
      }))
    console.log('[Editor] Input rules by extension:', inputRules)
  },
  editorProps: {
    attributes: {
      spellcheck: 'true'
    },
    handleTextInput: (view, from, to, text) => {
      const textBefore = view.state.doc.textBetween(Math.max(0, from - 10), from)
      const textAtPos = view.state.doc.textBetween(from, to)
      console.log('[Editor] handleTextInput:', { 
        from, 
        to, 
        text, 
        textBefore: textBefore,
        textAtPos: textAtPos,
        fullText: view.state.doc.textBetween(Math.max(0, from - 20), Math.min(view.state.doc.content.size, from + 20))
      })
      return false // Let input rules handle it
    },
    transformPastedHTML: (html: string) => {
      // If it's already HTML (contains tags), return as-is so TipTap can parse it
      // TipTap will automatically parse HTML tags like <h1>, <p>, etc.
      if (html.includes('<') && html.includes('>')) {
        return html // Already HTML, TipTap will parse it
      }
      
      // If it's plain text that looks like markdown, convert it
      const converted = markdownToHTML(html)
      return converted
    }
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      },
      // Disable list extensions in StarterKit to avoid conflicts
      // We'll add them explicitly below to ensure they work properly
      bulletList: false,
      orderedList: false,
      listItem: false
    }),
    // TaskList and TaskItem MUST come before BulletList to ensure input rules take precedence
    // This prevents [] from being matched by BulletList
    TaskList,
    TaskItemWithStrike.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex items-start gap-2'
      }
    }),
    // Add list extensions explicitly to ensure they work properly
    BulletList.extend({
      addInputRules() {
        // Override to only match * - + and explicitly exclude [] patterns
        // This prevents conflict with TaskItem input rules
        console.log('[BulletList] Setting up input rules')
        return [
          {
            find: /^\s*([*\-+])\s$/,
            handler: ({ state, range, match, chain }) => {
              console.log('[BulletList] Input rule MATCHED! Pattern:', match[1], 'Match:', match, 'Range:', range)
              console.log('[BulletList] Text at range:', state.doc.textBetween(range.from, range.to))
              return chain()
                .deleteRange({ from: range.from, to: range.to })
                .toggleBulletList()
                .run()
            }
          }
        ]
      }
    }).configure({
      HTMLAttributes: {
        class: 'bullet-list'
      }
    }),
    OrderedList.configure({
      HTMLAttributes: {
        class: 'ordered-list'
      }
    }),
    ListItem.configure({
      HTMLAttributes: {
        class: 'list-item'
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
    Table.configure({
      resizable: true,
      allowTableNodeSelection: true, // Allow selecting the entire table node
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
    }),
    YouTube.configure({
      HTMLAttributes: {
        class: 'youtube-embed'
      }
    }),
    Gapcursor,
    TableExit, // Custom extension for table navigation
    MarkdownPaste, // Custom extension for markdown paste support
    SlashCommand // Custom extension for slash commands
  ]
})

// Watch for external changes to content
// Only update if the editor is not focused (user is not actively typing)
watch(() => props.modelValue, (newValue) => {
  if (!editor.value) return;
  
  const currentContent = editor.value.getHTML();
  const isFocused = editor.value.isFocused;
  
  // Only update if content actually changed and editor is not focused
  if (newValue !== currentContent && !isFocused) {
    editor.value.commands.setContent(newValue || '', { emitUpdate: false })
  }
})

// Watch for editable changes
watch(() => props.editable, (newValue) => {
  if (editor.value) {
    editor.value.setEditable(newValue)
  }
})

// Handle slash command (/) to show formatting menu - Notion style
watch(editor, (editorInstance) => {
  if (!editorInstance) return
  
  // Store editor instance for markdown paste
  editorInstanceForPaste = editorInstance
  
  // Register global callback for slash command
  slashCommandCallback = () => {
    console.log('[SlashCommand] Callback triggered')
    if (!editorInstance) {
      console.log('[SlashCommand] No editor instance')
      return
    }
    
    // Only trigger if not in code block
    if (editorInstance.isActive('codeBlock')) {
      console.log('[SlashCommand] In code block, skipping')
      return
    }
    
    // Get cursor position for menu placement
    const { from } = editorInstance.state.selection
    const coords = editorInstance.view.coordsAtPos(from)
    
    console.log('[SlashCommand] Showing menu at cursor:', { from, coords })
    
    // Show formatting menu - works anywhere like Notion
    if (showContextMenu.value) {
      console.log('[SlashCommand] Menu already open, closing')
      closeContextMenu()
    } else {
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const menuWidth = 224
      const estimatedMenuHeight = 350
      
      let x = coords.left
      let y = coords.top + 20
      
      if (y + estimatedMenuHeight > viewportHeight) {
        y = Math.max(8, viewportHeight - estimatedMenuHeight - 8)
      }
      if (x + menuWidth > viewportWidth) {
        x = Math.max(8, viewportWidth - menuWidth - 8)
      }
      
      contextMenuPos.value = { x, y }
      showContextMenu.value = true
      
      console.log('[SlashCommand] Menu opened at:', { x, y }, 'showContextMenu:', showContextMenu.value)
    }
  }
  
  console.log('[SlashCommand] Callback registered for editor instance')
}, { immediate: true })

// Cleanup callback on unmount
onBeforeUnmount(() => {
  slashCommandCallback = null
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
  if (!editor.value) return
  closeContextMenu()
  // Use nextTick to ensure menu closes before focusing
  nextTick(() => {
    editor.value?.chain().focus().toggleBulletList().run()
  })
}

function toggleOrderedList() {
  if (!editor.value) return
  closeContextMenu()
  // Use nextTick to ensure menu closes before focusing
  nextTick(() => {
    editor.value?.chain().focus().toggleOrderedList().run()
  })
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

function addYouTube() {
  youtubeUrl.value = ''
  showYouTubeModal.value = true
}

function confirmYouTube() {
  if (youtubeUrl.value.trim()) {
    editor.value?.chain().focus().setYouTube({ src: youtubeUrl.value.trim() }).run()
  }
  showYouTubeModal.value = false
  youtubeUrl.value = ''
}

function cancelYouTube() {
  showYouTubeModal.value = false
  youtubeUrl.value = ''
}

// File upload functions
function openFileDialog() {
  if (!props.noteId) {
    console.warn('Note ID is required for file uploads')
    return
  }
  fileInputRef.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  
  if (!files || files.length === 0 || !props.noteId) return
  
  await uploadFiles(Array.from(files))
  
  // Reset input
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function uploadFiles(files: File[]) {
  if (isUploadingFile.value || !props.noteId) return
  
  const authStore = useAuthStore()
  if (!authStore.token) {
    console.error('Not authenticated')
    return
  }
  
  isUploadingFile.value = true
  
  try {
    const uploadedAttachments = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      
      const attachment = await $fetch<{
        id: number;
        file_name: string;
        file_path: string;
        mime_type: string | null;
        presigned_url?: string;
      }>(`/api/notes/${props.noteId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
        body: formData,
      })
      
      uploadedAttachments.push(attachment)
      console.log('[TiptapEditor] Uploaded attachment:', attachment)
      
      // Emit event to notify parent component
      emit('attachment-uploaded', attachment)
      emit('attachmentUploaded', attachment)
      // Wait a tick to ensure event is processed
      await nextTick()
    }
    
    console.log('[TiptapEditor] Uploaded', uploadedAttachments.length, 'files')
    // Don't auto-insert images - they'll be shown as links at the top of the note
    // Images can still be inserted manually via the image button if needed
  } catch (error: any) {
    console.error('[TiptapEditor] Upload error:', error)
  } finally {
    isUploadingFile.value = false
  }
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

// Spell check handler - selects word and allows browser spell check to work
const allowNativeSpellCheck = ref(false)
const spellCheckActive = ref(false)
let spellCheckTimeout: ReturnType<typeof setTimeout> | null = null

function showSpellCheck() {
  if (!editor.value) {
    console.log('[SpellCheck] No editor available')
    return
  }
  
  // Clear any existing timeout
  if (spellCheckTimeout) {
    clearTimeout(spellCheckTimeout)
    spellCheckTimeout = null
  }
  
  closeContextMenu()
  
  // Get the current selection
  const { from, to } = editor.value.state.selection
  console.log('[SpellCheck] Current selection:', { from, to })
  
  let wordStart = from
  let wordEnd = to
  
  // If there's a selection, use it; otherwise select the word at cursor
  if (from === to) {
    // Find word boundaries - look for alphanumeric characters
    const textBefore = editor.value.state.doc.textBetween(
      Math.max(0, from - 100),
      from
    )
    const textAfter = editor.value.state.doc.textBetween(
      to,
      Math.min(editor.value.state.doc.content.size, to + 100)
    )
    
    // Match word boundaries (alphanumeric characters)
    const beforeMatch = textBefore.match(/([a-zA-Z0-9]+)$/)
    const afterMatch = textAfter.match(/^([a-zA-Z0-9]+)/)
    
    if (beforeMatch || afterMatch) {
      wordStart = beforeMatch ? from - beforeMatch[1].length : from
      wordEnd = afterMatch ? to + afterMatch[1].length : to
      
      const selectedWord = editor.value.state.doc.textBetween(wordStart, wordEnd)
      console.log('[SpellCheck] Selected word:', selectedWord, { wordStart, wordEnd })
      console.log('[SpellCheck] Word selected! Now right-click on the selected word to see spell check suggestions.')
      console.log('[SpellCheck] Note: Browser spell check menu only appears for misspelled words (red underline).')
      
      // Select the word
      editor.value.chain().setTextSelection({ from: wordStart, to: wordEnd }).focus().run()
      
      // Mark spell check as active
      spellCheckActive.value = true
      allowNativeSpellCheck.value = true
      
      // Show visual feedback - scroll to selection
      setTimeout(() => {
        const coords = editor.value?.view.coordsAtPos(wordStart)
        if (coords) {
          // Scroll the word into view
          editor.value?.view.dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 50)
      
      // Reset after longer delay to give user time to right-click
      spellCheckTimeout = setTimeout(() => {
        allowNativeSpellCheck.value = false
        spellCheckActive.value = false
        spellCheckTimeout = null
      }, 10000) // Extended to 10 seconds
    } else {
      console.log('[SpellCheck] No word found at cursor')
      // No word found, just focus the editor
      editor.value.chain().focus().run()
    }
  } else {
    // There's already a selection
    const selectedText = editor.value.state.doc.textBetween(from, to)
    console.log('[SpellCheck] Using existing selection:', selectedText)
    
    // Focus and keep selection
    editor.value.chain().focus().run()
    
    // Allow native menu for selected text
    spellCheckActive.value = true
    allowNativeSpellCheck.value = true
    
    spellCheckTimeout = setTimeout(() => {
      allowNativeSpellCheck.value = false
      spellCheckActive.value = false
      spellCheckTimeout = null
    }, 10000)
  }
}

// Context menu handlers
function handleContextMenu(event: MouseEvent) {
  if (!props.editable) return
  
  // Allow native menu temporarily for spell check
  if (allowNativeSpellCheck.value) {
    console.log('[SpellCheck] Allowing native browser menu')
    // Don't prevent default - let browser show native menu
    // But reset the flag after a short delay
    setTimeout(() => {
      allowNativeSpellCheck.value = false
      spellCheckActive.value = false
      if (spellCheckTimeout) {
        clearTimeout(spellCheckTimeout)
        spellCheckTimeout = null
      }
    }, 100)
    return // Let browser show native menu
  }
  
  // Always allow native browser menu for right-click (spell check, etc.)
  // Use "/" key for formatting menu instead
  console.log('[ContextMenu] Right-click detected - allowing native browser menu')
  // Don't prevent default - let browser show native menu with spell check
  return
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
  <div 
    class="tiptap-editor w-full relative"
  >
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
          v-if="noteId"
          @click="openFileDialog"
          :disabled="isUploadingFile"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Upload File"
        >
          <UIcon name="i-heroicons-paper-clip" class="w-5 h-5" />
        </button>
        <button
          @click="addYouTube"
          class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Add YouTube Video"
        >
          <UIcon name="i-heroicons-video-camera" class="w-5 h-5" />
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

    <!-- Hidden File Input -->
    <input
      v-if="noteId"
      ref="fileInputRef"
      type="file"
      class="hidden"
      multiple
      @change="handleFileSelect"
    />
    
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
            @click="toggleBulletList()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :class="editor?.isActive('bulletList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'"
          >
            <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
            <span class="flex-1 text-left">Bullet List</span>
            <span class="text-xs text-gray-400">⌘⇧8</span>
          </button>
          <button
            @click="toggleOrderedList()"
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
            @click="addYouTube(); closeContextMenu()"
            class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <UIcon name="i-heroicons-video-camera" class="w-4 h-4" />
            <span class="flex-1 text-left">YouTube Video</span>
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

    <!-- YouTube Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showYouTubeModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="cancelYouTube"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelYouTube"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <UIcon name="i-heroicons-video-camera" class="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Insert YouTube Video
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter the YouTube video URL or embed URL
            </p>

            <!-- Input -->
            <input
              v-model="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-6"
              @keyup.enter="confirmYouTube"
              autofocus
            />

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="cancelYouTube"
              >
                Cancel
              </UButton>
              <UButton
                color="primary"
                block
                @click="confirmYouTube"
                :disabled="!youtubeUrl.trim()"
              >
                Insert Video
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

/* Ensure Tailwind doesn't reset list styles */
.tiptap-editor .ProseMirror ul,
.tiptap-editor .ProseMirror ol {
  list-style: revert !important;
  padding-left: revert !important;
  margin: revert !important;
}

.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Gapcursor Styles - Make it visible and clickable after tables */
.tiptap-editor .ProseMirror-gapcursor {
  display: block;
  pointer-events: none;
  position: relative;
}

.tiptap-editor .ProseMirror-gapcursor:after {
  content: "";
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 2px solid #3b82f6;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}

@keyframes ProseMirror-cursor-blink {
  to {
    visibility: hidden;
  }
}

/* Add visible clickable space after tables and to the right */
.tiptap-editor .ProseMirror table {
  margin-bottom: 2rem !important;
  margin-right: 1rem !important;
  width: calc(100% - 1rem) !important; /* Leave space on the right */
}

.tiptap-editor .ProseMirror table + * {
  margin-top: 1rem;
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

/* List Styles - Ensure lists are visible and properly styled */
.tiptap-editor .ProseMirror ul,
.tiptap-editor .ProseMirror ol,
.tiptap-editor .ProseMirror ul[data-type="bulletList"],
.tiptap-editor .ProseMirror ol[data-type="orderedList"],
.tiptap-editor .ProseMirror .bullet-list,
.tiptap-editor .ProseMirror .ordered-list {
  padding-left: 1.625rem !important;
  margin-top: 0.75rem !important;
  margin-bottom: 0.75rem !important;
  list-style-position: outside !important;
  display: block !important;
}

.tiptap-editor .ProseMirror ul,
.tiptap-editor .ProseMirror ul[data-type="bulletList"],
.tiptap-editor .ProseMirror .bullet-list {
  list-style-type: disc !important;
}

.tiptap-editor .ProseMirror ol,
.tiptap-editor .ProseMirror ol[data-type="orderedList"],
.tiptap-editor .ProseMirror .ordered-list {
  list-style-type: decimal !important;
  list-style: decimal outside !important;
}

.tiptap-editor .ProseMirror li,
.tiptap-editor .ProseMirror li[data-type="listItem"],
.tiptap-editor .ProseMirror .list-item {
  margin-top: 0.25rem !important;
  margin-bottom: 0.25rem !important;
  display: list-item !important;
  list-style-position: outside !important;
  padding-left: 0 !important;
}

/* Ensure list items have proper spacing */
.tiptap-editor .ProseMirror li > p,
.tiptap-editor .ProseMirror li[data-type="listItem"] > p {
  margin-top: 0;
  margin-bottom: 0;
}

.tiptap-editor .ProseMirror li > p:first-child,
.tiptap-editor .ProseMirror li[data-type="listItem"] > p:first-child {
  margin-top: 0;
}

.tiptap-editor .ProseMirror li > p:last-child,
.tiptap-editor .ProseMirror li[data-type="listItem"] > p:last-child {
  margin-bottom: 0;
}

.tiptap-editor .ProseMirror ul ul,
.tiptap-editor .ProseMirror ol ul,
.tiptap-editor .ProseMirror ul[data-type="bulletList"] ul,
.tiptap-editor .ProseMirror ol[data-type="orderedList"] ul {
  list-style-type: circle;
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.tiptap-editor .ProseMirror ul ul ul,
.tiptap-editor .ProseMirror ol ul ul,
.tiptap-editor .ProseMirror ul[data-type="bulletList"] ul ul,
.tiptap-editor .ProseMirror ol[data-type="orderedList"] ul ul {
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

/* Code block styles - Notion-inspired */
.tiptap-editor .ProseMirror pre {
  background: #f7f6f3;
  color: #37352f;
  font-family: 'JetBrainsMono', 'Courier New', Courier, monospace;
  padding: 1rem 1.25rem;
  border-radius: 0.375rem;
  margin: 1rem 0;
  overflow-x: auto;
  border: 1px solid #e9e9e7;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
}

.dark .tiptap-editor .ProseMirror pre {
  background: #2e2e2e;
  color: #e8e8e8;
  border-color: #3e3e3e;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
}

.tiptap-editor .ProseMirror pre code {
  background: none;
  color: inherit;
  padding: 0;
  border: none;
  font-size: 0.875rem;
  line-height: 1.6;
  font-family: inherit;
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
  /* width is set above with right margin for clickability */
  margin: 1rem 0;
  display: block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  /* Enable smooth scrolling on mobile */
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
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

/* YouTube embed styles */
.tiptap-editor .ProseMirror .youtube-wrapper {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  height: 0;
  overflow: hidden;
  max-width: 100%;
  margin: 1.5rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
}

.tiptap-editor .ProseMirror .youtube-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
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


/* Fade transition for floating button */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
