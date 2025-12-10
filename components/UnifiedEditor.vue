<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import Collaboration from '@tiptap/extension-collaboration'
// Import individual extensions instead of StarterKit
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Strike from '@tiptap/extension-strike'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Blockquote from '@tiptap/extension-blockquote'
import HardBreak from '@tiptap/extension-hard-break'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
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
import Gapcursor from '@tiptap/extension-gapcursor'
import History from '@tiptap/extension-history'
import { Extension, Mark } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import ydocManager from '~/utils/ydocManager.client'
import { YouTube } from './YouTubeExtension'
import EditorToolbar from './EditorToolbar.vue'

// Custom mark for highlighting text with user colors that fade to normal
const UserHighlight = Mark.create({
  name: 'userHighlight',
  
  addAttributes() {
    return {
      userColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-user-color'),
        renderHTML: attributes => {
          if (!attributes.userColor) {
            return {}
          }
          return {
            'data-user-color': attributes.userColor,
            style: `color: ${attributes.userColor}; transition: color 2s ease-out;`,
            class: 'user-highlight-text'
          }
        },
      },
      userId: {
        default: null,
        parseHTML: element => element.getAttribute('data-user-id'),
        renderHTML: attributes => {
          if (!attributes.userId) {
            return {}
          }
          return {
            'data-user-id': attributes.userId,
          }
        },
      },
      timestamp: {
        default: Date.now(),
        parseHTML: element => parseInt(element.getAttribute('data-timestamp') || '0'),
        renderHTML: attributes => {
          return {
            'data-timestamp': attributes.timestamp?.toString() || Date.now().toString(),
          }
        },
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-user-color]',
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('userHighlightFade'),
        appendTransaction(transactions, oldState, newState) {
          const tr = newState.tr
          let modified = false
          
          // Check all user highlight marks and remove them after 2 seconds
          newState.doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark, markIndex) => {
                if (mark.type.name === 'userHighlight') {
                  const timestamp = mark.attrs.timestamp || 0
                  const age = Date.now() - timestamp
                  
                  // Remove mark after 2 seconds (2000ms)
                  if (age > 2000) {
                    const markType = newState.schema.marks.userHighlight
                    if (markType) {
                      tr.removeMark(pos, pos + node.nodeSize, markType)
                      modified = true
                    }
                  }
                }
              })
            }
          })
          
          return modified ? tr : null
        },
      }),
    ]
  },
})

// Custom TaskItem extension that applies strike formatting when checked
const TaskItemWithStrike = TaskItem.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      toggleTaskList: () => ({ tr, state, dispatch }) => {
        const { selection } = state
        const { $from, $to } = selection
        
        // Check if we're already in a task list
        let inTaskList = false
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'taskList') {
            inTaskList = true
            break
          }
        }
        
        if (inTaskList) {
          // Toggle off - convert task list back to paragraph
          return this.parent?.()?.toggleTaskList()?.()
        } else {
          // Toggle on - wrap selection in task list
          const taskListType = state.schema.nodes.taskList
          const taskItemType = state.schema.nodes.taskItem
          const paragraphType = state.schema.nodes.paragraph
          
          if (!taskListType || !taskItemType || !paragraphType) {
            return false
          }
          
          // Get the selected content
          const selectedContent = state.doc.slice(selection.from, selection.to)
          
          // Create a paragraph with the selected content (or empty paragraph if no selection)
          const paragraph = paragraphType.create(null, selectedContent.content.size > 0 ? selectedContent.content : [])
          const taskItem = taskItemType.create({ checked: false }, paragraph)
          const taskList = taskListType.create(null, taskItem)
          
          // Replace selection with task list
          tr.replaceSelectionWith(taskList)
          
          // Set cursor inside the paragraph of the task item
          // After taskList insertion, find the paragraph position
          const newPos = selection.from
          
          // Use nextTick to ensure the document is updated, then find the paragraph
          // Actually, we can find it immediately after replaceSelectionWith
          const insertedNode = tr.doc.nodeAt(newPos)
          if (insertedNode && insertedNode.firstChild) {
            const taskItemNode = insertedNode.firstChild
            // Find the paragraph node inside the task item
            // TaskItem structure: taskItem -> content (paragraph)
            let paragraphPos = newPos + 1 // After taskList start
            taskItemNode.forEach((node, offset) => {
              if (node.type.name === 'paragraph') {
                // Position = taskList start + 1 (taskItem start) + offset + 1 (paragraph start)
                paragraphPos = newPos + 1 + offset + 1
              }
            })
            // Set cursor at the start of the paragraph (position 0 inside the paragraph)
            tr.setSelection(TextSelection.create(tr.doc, paragraphPos))
          } else {
            // Fallback: try to find any paragraph position near the insertion
            tr.setSelection(TextSelection.near(tr.doc.resolve(newPos + 2)))
          }
          
          if (dispatch) {
            dispatch(tr)
          }
          return true
        }
      }
    }
  },
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() || []
    
    // Plugin to handle [] input anywhere (not just start of line)
    // This MUST run before BulletList input rules
    // Use append: false to ensure it runs BEFORE other plugins
    const taskItemInputPlugin = new Plugin({
      key: new PluginKey('taskItemInputHandler'),
      append: false, // Run before other plugins
      props: {
        handleTextInput: (view, from, to, text) => {
          // Only handle space after ]
          if (text !== ' ') {
            return false
          }
          
          const { state } = view
          const $from = state.doc.resolve(from)
          
          // Check if we're in a code block - don't interfere
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'codeBlock') {
              return false
            }
          }
          
          // Look back to see if we have [] before the space
          // Check more context to see if we're at start of line
          const lineStart = $from.start($from.depth)
          const textBefore = state.doc.textBetween(Math.max(lineStart, from - 10), from)
          const match = textBefore.match(/\[([ x])\]$/)
          
          if (match) {
            const checked = match[1] === 'x'
            const startPos = from - match[0].length
            const endPos = from + 1 // Include the space
            
            const { tr } = state
            const $start = tr.doc.resolve(startPos)
            
            // Check if we're already in a task list
            let inTaskList = false
            for (let d = $start.depth; d > 0; d--) {
              if ($start.node(d).type.name === 'taskList') {
                inTaskList = true
                break
              }
            }
            
            // Delete the [] and space
            tr.delete(startPos, endPos)
            
            if (!inTaskList) {
              // Create task list with task item
              const taskListType = state.schema.nodes.taskList
              const taskItemType = state.schema.nodes.taskItem
              if (taskListType && taskItemType) {
                // Create a paragraph inside the task item for the content
                const paragraph = state.schema.nodes.paragraph.create()
                const taskItem = taskItemType.create({ checked }, paragraph)
                const taskList = taskListType.create(null, taskItem)
                tr.replaceWith(startPos, startPos, taskList)
                // Set cursor inside the paragraph within the task item
                // After inserting, find the first text position inside the task item
                // TaskList structure: <ul><li><p></p></li></ul>
                // We want cursor inside the <p>
                const insertedNode = tr.doc.nodeAt(startPos)
                if (insertedNode) {
                  // Find the first text position inside the task item's paragraph
                  let textPos = startPos + 1 // Start after taskList
                  insertedNode.descendants((node, pos) => {
                    if (node.type.name === 'paragraph' && node.isBlock) {
                      // Found the paragraph, set cursor at the start
                      textPos = startPos + pos + 1
                      return false // Stop searching
                    }
                  })
                  tr.setSelection(TextSelection.near(tr.doc.resolve(textPos)))
                } else {
                  // Fallback: just after the task list
                  tr.setSelection(TextSelection.near(tr.doc.resolve(startPos + 1)))
                }
                view.dispatch(tr)
                // Ensure focus is maintained on mobile after transaction
                requestAnimationFrame(() => {
                  view.focus()
                })
                return true // Return true to prevent other handlers (like BulletList) from running
              }
            } else {
              // Already in task list, just create task item
              const taskItemType = state.schema.nodes.taskItem
              if (taskItemType) {
                const paragraph = state.schema.nodes.paragraph.create()
                const taskItem = taskItemType.create({ checked }, paragraph)
                tr.replaceWith(startPos, startPos, taskItem)
                // Set cursor inside the paragraph within the task item
                const insertedNode = tr.doc.nodeAt(startPos)
                if (insertedNode) {
                  // Find the paragraph node inside the task item
                  let paragraphPos = startPos + 1 // After taskItem start
                  insertedNode.forEach((node, offset) => {
                    if (node.type.name === 'paragraph') {
                      paragraphPos = startPos + 1 + offset + 1 // taskItem + paragraph
                    }
                  })
                  // Set cursor at the start of the paragraph
                  tr.setSelection(TextSelection.create(tr.doc, paragraphPos))
                } else {
                  // Fallback: simple position calculation
                  tr.setSelection(TextSelection.create(tr.doc, startPos + 2))
                }
                view.dispatch(tr)
                // Ensure focus is maintained on mobile after transaction
                requestAnimationFrame(() => {
                  view.focus()
                })
                return true // Return true to prevent other handlers (like BulletList) from running
              }
            }
          }
          
          return false
        }
      }
    })
    
    // Add strike plugin
    const strikePlugin = new Plugin({
      key: new PluginKey('taskItemStrike'),
      appendTransaction(transactions, oldState, newState) {
          // Only process if the document actually changed
          if (!transactions.some(tr => tr.docChanged)) {
            return null
          }

          const tr = newState.tr
          let modified = false

          // Iterate through all task items to check for checked state changes
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'taskItem') {
              const isChecked = node.attrs.checked
              // Check if position exists in old document before accessing it
              // (pasted content may have positions that didn't exist before)
              const oldNode = pos < oldState.doc.content.size ? oldState.doc.nodeAt(pos) : null
              const wasChecked = oldNode?.attrs?.checked || false

              // If checked state changed, apply or remove strike formatting
              if (isChecked !== wasChecked) {
                // Find all text nodes within the task item and apply/remove strike
                const contentStart = pos + 1
                const contentEnd = pos + node.nodeSize - 1

                newState.doc.nodesBetween(contentStart, contentEnd, (textNode, textPos) => {
                  if (textNode.isText && textPos >= 0 && textPos + textNode.nodeSize <= newState.doc.content.size) {
                    const hasStrike = textNode.marks.some(mark => mark.type.name === 'strike')
                    const strikeMarkType = newState.schema.marks.strike
                    
                    if (!strikeMarkType) {
                      return
                    }
                    
                    if (isChecked && !hasStrike) {
                      const strikeMark = strikeMarkType.create()
                      tr.addMark(textPos, textPos + textNode.nodeSize, strikeMark)
                      modified = true
                    } else if (!isChecked && hasStrike) {
                      const strikeMark = textNode.marks.find(mark => mark.type.name === 'strike')
                      if (strikeMark) {
                        tr.removeMark(textPos, textPos + textNode.nodeSize, strikeMark)
                        modified = true
                      }
                    }
                  }
                })
              }
            }
          })

          return modified ? tr : null
        }
      })
    
    return [...parentPlugins, taskItemInputPlugin, strikePlugin]
  }
})

// Global callback for slash command (accessible from plugin)
let slashCommandCallback: (() => void) | null = null

// Store editor reference for markdown paste
let editorInstanceForPaste: any = null

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

// Helper function to convert markdown to HTML (same as TiptapEditor)
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
      processedLines.push(`<ul><li>${processInlineMarkdown(bulletMatch[1])}</li></ul>`)
      return
    }
    
    // Numbered lists
    const numberMatch = trimmedLine.match(/^\d+\.\s+(.+)$/)
    if (numberMatch && numberMatch[1]) {
      processedLines.push(`<ol><li>${processInlineMarkdown(numberMatch[1])}</li></ol>`)
      return
    }
    
    // Blockquotes
    const quoteMatch = trimmedLine.match(/^>\s+(.+)$/)
    if (quoteMatch && quoteMatch[1]) {
      processedLines.push(`<blockquote>${processInlineMarkdown(quoteMatch[1])}</blockquote>`)
      return
    }
    
    // Regular paragraphs (if not empty)
    if (trimmedLine) {
      processedLines.push(`<p>${processInlineMarkdown(line)}</p>`)
    } else {
      // Preserve empty lines as empty paragraphs
      processedLines.push('<p></p>')
    }
  })
  
  // Process lists (merge adjacent lists)
  let html = processedLines.join('')
  html = html.replace(/<\/ul><ul>/g, '')
  html = html.replace(/<\/ol><ol>/g, '')
  
  return html
}

// Custom extension for markdown paste support
const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste: (view, event, slice) => {
            const text = event.clipboardData?.getData('text/plain')
            const html = event.clipboardData?.getData('text/html')
            
            // If we have HTML, let default handler handle it (it might be from another editor)
            // UNLESS it looks like it was copied from a raw markdown source
            if (html && !text?.match(/^#{1,6}\s|^[-*+]\s|^\d+\.\s|^>\s|```/m)) {
              return false
            }
            
            if (!text) return false
            
            // Check if text looks like markdown
            // Headings, lists, blockquotes, code blocks
            const isMarkdown = [
              /^#{1,6}\s+.+$/m,           // Headings
              /^[-*+]\s+.+$/m,            // Bullet lists
              /^\d+\.\s+.+$/m,            // Numbered lists
              /^>\s+.+$/m,                // Blockquotes
              /^---$/m,                   // Horizontal rules
              /^```[\s\S]*?```$/m         // Code blocks
            ].some(pattern => pattern.test(text))
            
            if (!isMarkdown) return false
            
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

// Custom extension for table exit
const TableExit = Extension.create({
  name: 'tableExit',

  addKeyboardShortcuts() {
    return {
      'ArrowDown': ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're inside a table
        let tableNode = null
        let tablePos = -1
        
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            tableNode = $from.node(d)
            tablePos = $from.before(d)
            break
          }
        }

        if (!tableNode) {
          return false
        }

        // Check if we're in the last row
        const cellNode = $from.node($from.depth) // TableCell or TableHeader
        const rowNode = $from.node($from.depth - 1) // TableRow
        
        if (!rowNode || rowNode.type.name !== 'tableRow') {
          return false
        }

        // Find the index of the current row in the table
        let rowIndex = -1
        tableNode.forEach((node, offset, index) => {
          if (node === rowNode) {
            rowIndex = index
          }
        })

        // If it's the last row
        if (rowIndex === tableNode.childCount - 1) {
          // Create a new paragraph after the table
          const afterTablePos = tablePos + tableNode.nodeSize
          
          // Check if there's already a node after the table
          if (afterTablePos >= state.doc.content.size) {
            // Append paragraph at end of document
            editor.chain().insertContentAt(afterTablePos, { type: 'paragraph' }).setTextSelection(afterTablePos + 1).run()
            return true
          } else {
            // Move cursor to the node after table
            const nodeAfter = state.doc.nodeAt(afterTablePos)
            if (nodeAfter && nodeAfter.type.name === 'paragraph' && nodeAfter.content.size === 0) {
              // Empty paragraph exists, move there
              editor.chain().setTextSelection(afterTablePos + 1).run()
              return true
            } else {
              // Insert new paragraph
              editor.chain().insertContentAt(afterTablePos, { type: 'paragraph' }).setTextSelection(afterTablePos + 1).run()
              return true
            }
          }
        }

        return false
      }
    }
  }
})

const props = defineProps<{
  modelValue?: string;
  initialContent?: string;
  editable?: boolean;
  placeholder?: string;
  noteId?: string;
  isCollaborative?: boolean;
  isPolishing?: boolean;
  isAskingAI?: boolean;
  searchQuery?: string | null; // Search query to highlight matches
  // Optional callback for when attachment is uploaded
  onAttachmentUpload?: (attachment: any) => void;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:content', value: string): void;
  (e: 'attachment-uploaded', attachment: any): void;
  (e: 'attachmentUploaded', attachment: any): void;
  (e: 'request-polish'): void;
  (e: 'request-ask-ai', prompt: string): void;
}>();

function handlePolish() {
  console.log('[UnifiedEditor] Polish event received from toolbar, emitting request-polish to parent');
  emit('request-polish');
}

function handleAskAI(prompt: string) {
  console.log('[UnifiedEditor] AskAI event received from toolbar, emitting request-ask-ai to parent');
  emit('request-ask-ai', prompt);
}

// Editor state
const editorContainer = ref<HTMLElement | null>(null)
const isUploadingFile = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Modals state
const showLinkModal = ref(false)
const linkUrl = ref('')
const showImageModal = ref(false)
const imageUrl = ref('')
const showYouTubeModal = ref(false)
const youtubeUrl = ref('')
const showShortcutsModal = ref(false) // Added but unused in this refactor to avoid breakage

// Collaboration state
const provider = ref<WebsocketProvider | null>(null)
const connectionStatus = ref('disconnected')
const connectedUsers = ref(0)
const collaboratorCursors = ref<any[]>([])
const isInitialized = ref(false)
const isDestroying = ref(false)

// Table menu state - removed in favor of toolbar
// const tableMenuPosition = ref<{ x: number, y: number } | null>(null)

// Slash command state (removed)
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const submenuButtonRefs = ref<Record<string, HTMLElement>>({})
const contextMenuSubmenu = ref<string | null>(null)

// Editor configuration
const baseExtensions = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  Strike,
  Code,
  CodeBlock.configure({
    HTMLAttributes: {
      class: 'bg-gray-100 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto'
    }
  }),
  Heading.configure({
    levels: [1, 2, 3]
  }),
  BulletList.configure({
    HTMLAttributes: {
      class: 'list-disc list-outside ml-4 my-2'
    }
  }),
  OrderedList.configure({
    HTMLAttributes: {
      class: 'list-decimal list-outside ml-4 my-2'
    }
  }),
  ListItem,
  Blockquote.configure({
    HTMLAttributes: {
      class: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-600 dark:text-gray-400'
    }
  }),
  HardBreak,
  HorizontalRule,
  Link.configure({
    openOnClick: false, // We'll handle click manually if needed, but false is safer for editing
    HTMLAttributes: {
      class: 'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer'
    }
  }),
  Underline,
  TaskList.configure({
    HTMLAttributes: {
      class: 'not-prose pl-0' // Remove prose styles that might add bullets
    }
  }),
  TaskItemWithStrike.configure({
    nested: true,
    HTMLAttributes: {
      class: 'flex gap-2 items-start my-1'
    }
  }),
  Table.configure({
    resizable: true,
    HTMLAttributes: {
      class: 'border-collapse table-fixed w-full my-4'
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
    inline: false,
    allowBase64: true,
    HTMLAttributes: {
      class: 'rounded-lg max-w-full h-auto'
    }
  }),
  YouTube.configure({
    HTMLAttributes: {
      class: 'w-full aspect-video rounded-lg'
    }
  }),
  Gapcursor,
  TableExit,
  MarkdownPaste,
  Placeholder.configure({
    placeholder: props.placeholder || 'Start writing...'
  }),
]

// CONDITIONAL: Add History extension only for non-collaborative notes
// (Collaborative editing uses Y.Doc's own history mechanism)
// Access ydoc from ydocManager
let ydoc: Y.Doc | null = null
if (props.isCollaborative && props.noteId) {
  ydoc = ydocManager.getDoc(props.noteId)
}

if (!props.isCollaborative || !ydoc) {
  baseExtensions.push(History)
}

// CONDITIONAL: Add Collaboration extension only if collaborative
if (props.isCollaborative && ydoc) {
  baseExtensions.unshift(
    Collaboration.configure({
      document: ydoc
    })
  )
  // Add UserHighlight mark only for collaborative
  baseExtensions.push(UserHighlight)
}

// Initialize editor
const editor = useEditor({
  editable: props.editable,
  // For regular notes, use modelValue or initialContent
  // For collaborative notes, don't set initial content (Y.Doc handles it)
  content: props.isCollaborative ? undefined : (props.modelValue || props.initialContent || ''),
  onBeforeCreate() {
  },
  onCreate: ({ editor }) => {
    // Scroll to first match when editor is created if search query exists
    if (props.searchQuery) {
      nextTick(() => {
        scrollToFirstMatch(props.searchQuery)
      })
    }
  },
  editorProps: {
    attributes: {
      spellcheck: 'true',
      class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] px-8 py-6'
    },
    // Removed handleTextInput - let the TaskItem plugin handle [] pattern detection
    // The plugin's handleTextInput will run and can return true to prevent other handlers
  },
  extensions: baseExtensions,
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    if (props.isCollaborative) {
      // For collaborative notes, emit update:content
      emit('update:content', html)
    } else {
      // For regular notes, emit update:modelValue (v-model)
      emit('update:modelValue', html)
    }
  }
})


// Expose methods for parent components to access editor content
function getHTML(): string {
  return editor.value?.getHTML() || ''
}

function getCurrentContent(): string {
  return editor.value?.getHTML() || ''
}

defineExpose({
  getHTML,
  getCurrentContent,
  openFileDialog,
  connectionStatus: props.isCollaborative ? connectionStatus : undefined,
  connectedUsers: props.isCollaborative ? connectedUsers : undefined
})

// Watch for external changes to content (only for regular notes)
// For collaborative notes, Y.Doc handles syncing
if (!props.isCollaborative) {
  watch(() => props.modelValue, (newValue) => {
    if (!editor.value) return;
    
    const currentContent = editor.value.getHTML();
    const isFocused = editor.value.isFocused;
    
    // Only update if content actually changed and editor is not focused
    if (newValue !== currentContent && !isFocused) {
      editor.value.commands.setContent(newValue || '', { emitUpdate: false })
    }
  })
}

// Watch for editable changes
watch(() => props.editable, (newValue) => {
  if (editor.value) {
    editor.value.setEditable(newValue)
  }
})

// Track if we've already scrolled for this note + search query combination
const hasScrolledForSearch = ref<{ noteId: string; query: string } | null>(null)

// Function to scroll to first match (no highlighting)
function scrollToFirstMatch(query: string | null, noteId?: string) {
  if (!editor.value || !query || !query.trim()) {
    return
  }
  
  const currentNoteId = noteId || props.noteId || ''
  const searchQuery = query.trim()
  
  // Check if we've already scrolled for this note + query combination
  if (hasScrolledForSearch.value?.noteId === currentNoteId && 
      hasScrolledForSearch.value?.query === searchQuery) {
    return // Already scrolled for this combination, don't scroll again
  }
  
  let firstMatchPos: number | null = null
  
  // Find first match position
  editor.value.state.doc.descendants((node, pos) => {
    if (node.isText && firstMatchPos === null) {
      const text = node.text
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const match = regex.exec(text)
      
      if (match) {
        firstMatchPos = pos + match.index
      }
    }
  })
  
  // Scroll to first match after a short delay to ensure DOM is updated
  if (firstMatchPos !== null) {
    setTimeout(() => {
      try {
        const coords = editor.value!.view.coordsAtPos(firstMatchPos!)
        const editorEl = editor.value!.view.dom.closest('.prose') || editor.value!.view.dom.parentElement
        if (editorEl && editorEl instanceof HTMLElement) {
          editorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Mark that we've scrolled for this note + query combination
          hasScrolledForSearch.value = { noteId: currentNoteId, query: searchQuery }
        }
      } catch (e) {
        // Ignore scroll errors
      }
    }, 200)
  }
}

// Watch for note ID changes - reset scroll tracking when note changes
watch(() => props.noteId, (newNoteId) => {
  // Reset scroll tracking when switching to a different note
  if (hasScrolledForSearch.value?.noteId !== newNoteId) {
    hasScrolledForSearch.value = null
  }
})

// Watch for search query changes and scroll to first match (only once)
watch(() => props.searchQuery, (newQuery) => {
  if (editor.value && newQuery) {
    const currentNoteId = props.noteId || ''
    // Only scroll if we haven't scrolled for this note + query yet
    if (hasScrolledForSearch.value?.noteId !== currentNoteId || 
        hasScrolledForSearch.value?.query !== newQuery.trim()) {
      nextTick(() => {
        setTimeout(() => {
          scrollToFirstMatch(newQuery, currentNoteId)
        }, 300)
      })
    }
  }
}, { immediate: true })

// Also watch for when editor becomes available and we have a search query
watch(editor, (editorInstance) => {
  if (editorInstance && props.searchQuery) {
    const currentNoteId = props.noteId || ''
    // Only scroll if we haven't scrolled for this note + query yet
    if (hasScrolledForSearch.value?.noteId !== currentNoteId || 
        hasScrolledForSearch.value?.query !== props.searchQuery.trim()) {
      nextTick(() => {
        setTimeout(() => {
          scrollToFirstMatch(props.searchQuery, currentNoteId)
        }, 300)
      })
    }
  }
})

// Cleanup callback on unmount
onBeforeUnmount(() => {
  slashCommandCallback = null
})

// Function to recalculate and update cursor position (only for collaborative)
function updateCursorPosition(editorInstance?: typeof editor.value) {
  if (!props.isCollaborative) return
  
  const ed = editorInstance || editor.value
  if (!ed || !provider.value?.awareness || isDestroying.value) return
  
  try {
    const { from } = ed.state.selection
    const coords = ed.view.coordsAtPos(from)
    const editorEl = editorContainer.value
    
    if (editorEl) {
      const editorRect = editorEl.getBoundingClientRect()
      // Calculate position relative to editor container
      const relativeX = coords.left - editorRect.left + editorEl.scrollLeft
      const relativeY = coords.top - editorRect.top + editorEl.scrollTop
      
      provider.value.awareness.setLocalStateField('cursor', {
        x: relativeX,
        y: relativeY,
        position: from // Document position
      })
    }
  } catch (error) {
    // Ignore coordinate errors
  }
}

// Function to update cursor screen positions from document positions - synchronous
// This is the KEY to perfect cursor placement during co-editing
function updateCursorScreenPositions() {
  if (!editor.value || !editorContainer.value || isDestroying.value) return
  
  // Table menu position logic removed - now handled by toolbar

  if (!props.isCollaborative) return
  
  // Update synchronously - no delays
  collaboratorCursors.value.forEach(user => {
    if (user.position !== undefined) {
      try {
        const coords = editor.value!.view.coordsAtPos(user.position)
        const editorEl = editorContainer.value
        
        if (editorEl && coords) {
          const editorRect = editorEl.getBoundingClientRect()
          user.x = coords.left - editorRect.left + editorEl.scrollLeft
          user.y = coords.top - editorRect.top + editorEl.scrollTop
        }
      } catch (err) {
        // Ignore coordinate errors
      }
    }
  })
}

// Set up collaborative editing (only if isCollaborative is true)
if (props.isCollaborative) {
  // Track cursor position for awareness and emit content updates
  watch(editor, (editorInstance) => {
    if (!editorInstance) return
    
    // Store editor instance for markdown paste
    editorInstanceForPaste = editorInstance
    
    // Track cursor position for awareness - store document position
    editorInstance.on('selectionUpdate', ({ editor: ed }) => {
      if (!provider.value?.awareness || isDestroying.value) return
    
    try {
      const { from } = ed.state.selection
      const coords = ed.view.coordsAtPos(from)
      const editorEl = editorContainer.value
      
      if (editorEl) {
        const editorRect = editorEl.getBoundingClientRect()
        const relativeX = coords.left - editorRect.left + editorEl.scrollLeft
        const relativeY = coords.top - editorRect.top + editorEl.scrollTop
        
        // Store both screen position and document position
        provider.value.awareness.setLocalStateField('cursor', {
          x: relativeX,
          y: relativeY,
          position: from // Document position
        })
      }
    } catch (error) {
      // Ignore coordinate errors
    }
  })
  
  // Track document changes to apply highlights and update cursor positions
  editorInstance.on('update', ({ editor: ed, transaction }) => {
    if (isDestroying.value) return
    
    try {
      // Update cursor positions synchronously after document changes
      // This prevents the cursor from jumping as text is inserted
      updateCursorScreenPositions()
      
      const html = ed.getHTML()
      emit('update:content', html)
    } catch (error) {
      // Ignore errors during destruction
    }
  })
  
  // Also update on selection changes (cursor moves)
  editorInstance.on('selectionUpdate', () => {
    if (isDestroying.value) return
    updateCursorScreenPositions()
  })
  
  // Add a plugin to track insertions, apply highlights, and update cursor positions
  editorInstance.registerPlugin(
    new Plugin({
      key: new PluginKey('collaborativeHighlight'),
      appendTransaction(transactions, oldState, newState) {
        // Find remote insertions and apply highlights
        // Position updates happen in view.update() which runs after DOM updates
        let modified = false
        const tr = newState.tr
        
        transactions.forEach(transaction => {
          const isRemote = transaction.getMeta('origin') === 'yjs' || transaction.getMeta('isRemote')
          
          if (isRemote && transaction.steps.length > 0) {
            transaction.steps.forEach((step: any) => {
              if (step.from !== undefined && step.to !== undefined && step.to > step.from) {
                // This is an insertion - find which user made it
                const insertPos = step.from
                const endPos = step.to
                const otherUsers = collaboratorCursors.value.filter(u => u.position !== undefined)
                
                // Find the closest user's cursor position
                let closestUser: typeof otherUsers[0] | null = null
                let minDistance = Infinity
                
                otherUsers.forEach(user => {
                  if (user.position !== undefined) {
                    // Check if insertion is at or near this user's cursor
                    const distance = Math.abs(user.position - insertPos)
                    // Allow up to 20 characters of distance (user might be typing quickly)
                    if (distance < 20 && distance < minDistance) {
                      minDistance = distance
                      closestUser = user
                    }
                  }
                })
                
                // Apply highlight mark if we found a user
                if (closestUser && newState.schema.marks.userHighlight) {
                  const markType = newState.schema.marks.userHighlight
                  const mark = markType.create({
                    userColor: closestUser.color,
                    userId: closestUser.clientId.toString(),
                    timestamp: Date.now()
                  })
                  
                  // Apply mark to the inserted content
                  try {
                    tr.addMark(insertPos, endPos, mark)
                    modified = true
                  } catch (err) {
                    // Ignore errors
                  }
                }
              }
            })
          }
        })
        
        return modified ? tr : null
      },
      // Also update on view updates - synchronous
      view() {
        return {
          update(view, prevState) {
            // Update cursor positions synchronously when view updates
            // This catches all document and selection changes
            updateCursorScreenPositions()
          }
        }
      }
    })
  )
  })
} else {
  // For non-collaborative notes, we still need to update table menu
  watch(editor, (editorInstance) => {
    if (!editorInstance) return
    
    editorInstance.on('selectionUpdate', () => {
      updateCursorScreenPositions()
    })
    
    editorInstance.on('update', () => {
      updateCursorScreenPositions()
    })
  })
}

// Context menu handlers (matches regular editor)
function handleContextMenu(event: MouseEvent) {
  // Removed context menu logic as requested
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuSubmenu.value = null
}

// Link handlers
function setLink() {
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

// Image handlers
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
    console.warn('[UnifiedEditor] Note ID is required for file uploads')
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
    console.error('[UnifiedEditor] Not authenticated')
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
      console.log('[UnifiedEditor] Uploaded attachment:', attachment)
      
      // Emit event to notify parent component
      emit('attachment-uploaded', attachment)
      emit('attachmentUploaded', attachment)
      
      // Call callback if provided
      if (props.onAttachmentUpload) {
        await props.onAttachmentUpload(attachment)
      }
      
      // Wait a tick to ensure event is processed
      await nextTick()
    }
    
    console.log('[UnifiedEditor] Uploaded', uploadedAttachments.length, 'files')
  } catch (error: any) {
    console.error('[UnifiedEditor] Upload error:', error)
  } finally {
    isUploadingFile.value = false
  }
}
</script>

<template>
  <div class="unified-editor w-full flex flex-col h-full" :class="{ 'collaborative-editor': isCollaborative }">
    <EditorToolbar 
      v-if="editor"
      :editor="editor" 
      :is-polishing="isPolishing"
      :is-asking-a-i="isAskingAI"
      @insert-link="setLink" 
      @insert-image="addImage" 
      @insert-youtube="addYouTube"
      @insert-table="editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
      @polish="handlePolish"
      @ask-ai="handleAskAI"
    />

    <!-- Connection status indicator (only for collaborative notes) -->
    <div
      v-if="isCollaborative && connectionStatus !== 'connected'"
      class="mb-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm flex items-center gap-2"
    >
      <UIcon name="i-heroicons-wifi" class="w-4 h-4 animate-pulse text-yellow-600 dark:text-yellow-400" />
      <span v-if="connectionStatus === 'connecting'" class="text-yellow-700 dark:text-yellow-300">
        Connecting to collaboration server...
      </span>
      <span v-else class="text-yellow-700 dark:text-yellow-300">
        Disconnected. Attempting to reconnect...
      </span>
    </div>

    <!-- Connected users indicator with avatars (only for collaborative notes) -->
    <div
      v-if="isCollaborative && connectionStatus === 'connected' && connectedUsers > 1"
      class="mb-3 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm flex items-center gap-3"
    >
      <UIcon name="i-heroicons-user-group" class="w-4 h-4 text-green-600 dark:text-green-400" />
      <span class="text-green-700 dark:text-green-300">
        {{ connectedUsers }} {{ connectedUsers === 1 ? 'user' : 'users' }} editing
      </span>
      
      <!-- Show other users' avatars -->
      <div class="flex -space-x-2 ml-auto">
        <template v-for="user in collaboratorCursors" :key="user.clientId">
          <div 
            v-if="user.name" 
            class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-white dark:ring-gray-800"
            :style="{ backgroundColor: user.color }"
            :title="user.name"
          >
            {{ user.name.charAt(0).toUpperCase() }}
          </div>
        </template>
      </div>
    </div>

    <div ref="editorContainer" class="flex-1 overflow-y-auto relative">
      <editor-content :editor="editor" />
      
      <!-- Custom Table Menu Removed - Moved to Toolbar -->

      <!-- Collaboration cursors overlay -->
      <div v-if="isCollaborative" class="collaboration-cursors-layer absolute inset-0 pointer-events-none overflow-hidden">
        <template v-for="user in collaboratorCursors" :key="user.clientId">
          <div
            v-if="user.x !== undefined && user.y !== undefined"
            class="collaboration-cursor absolute transition-all duration-100 ease-out z-50"
            :style="{
              left: `${user.x}px`,
              top: `${user.y}px`,
              borderColor: user.color
            }"
          >
            <!-- Caret line -->
            <div 
              class="collaboration-cursor__caret h-5 w-0.5"
              :style="{ backgroundColor: user.color }"
            ></div>
            
            <!-- User label -->
            <div
              class="collaboration-cursor__label absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs text-white font-medium whitespace-nowrap shadow-sm opacity-0 transition-opacity duration-200"
              :style="{ backgroundColor: user.color }"
              :class="{ 'group-hover:opacity-100': true, 'opacity-100': user.active }"
            >
              {{ user.name }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Modals -->
    <ClientOnly>
      <Teleport to="body">
        <!-- Link Modal -->
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="showLinkModal" class="fixed inset-0 z-50 overflow-y-auto" @click.self="cancelLink">
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" @click.stop>
                <h3 class="text-lg font-semibold mb-4">Insert Link</h3>
                <UInput v-model="linkUrl" placeholder="https://example.com" class="mb-4" size="xl" :ui="{ padding: { xl: 'px-4 py-3' } }" autofocus @keyup.enter="confirmLink" />
                <div class="grid grid-cols-2 gap-3">
                  <UButton color="gray" variant="soft" block size="md" @click="cancelLink">Cancel</UButton>
                  <UButton color="primary" block size="md" @click="confirmLink">Insert</UButton>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Image Modal -->
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto" @click.self="cancelImage">
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" @click.stop>
                <h3 class="text-lg font-semibold mb-4">Insert Image</h3>
                <UInput v-model="imageUrl" placeholder="https://example.com/image.jpg" class="mb-4" size="xl" :ui="{ padding: { xl: 'px-4 py-3' } }" autofocus @keyup.enter="confirmImage" />
                <div class="grid grid-cols-2 gap-3">
                  <UButton color="gray" variant="soft" block size="md" @click="cancelImage">Cancel</UButton>
                  <UButton color="primary" block size="md" @click="confirmImage">Insert</UButton>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- YouTube Modal -->
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="showYouTubeModal" class="fixed inset-0 z-50 overflow-y-auto" @click.self="cancelYouTube">
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            <div class="flex min-h-full items-center justify-center p-4">
              <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6" @click.stop>
                <h3 class="text-lg font-semibold mb-4">Insert YouTube Video</h3>
                <UInput v-model="youtubeUrl" placeholder="https://youtube.com/watch?v=..." class="mb-4" size="xl" :ui="{ padding: { xl: 'px-4 py-3' } }" autofocus @keyup.enter="confirmYouTube" />
                <div class="grid grid-cols-2 gap-3">
                  <UButton color="gray" variant="soft" block size="md" @click="cancelYouTube">Cancel</UButton>
                  <UButton color="primary" block size="md" @click="confirmYouTube">Insert</UButton>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<style scoped>
/* Basic Editor Styles */
.unified-editor :deep(.ProseMirror),
.collaborative-editor :deep(.ProseMirror) {
  outline: none !important;
}

/* Styles moved to global css or scoped here if needed, mostly covered by Tailwind classes in editorProps */
.unified-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Force tables to be full width */
.unified-editor :deep(.ProseMirror table),
.collaborative-editor :deep(.ProseMirror table) {
  width: 100% !important;
  table-layout: fixed;
}

/* Explicit Heading Styles (in case Tailwind Typography is missing or overridden) */
.unified-editor :deep(.ProseMirror h1),
.collaborative-editor :deep(.ProseMirror h1) {
  font-size: 2.25em;
  font-weight: 800;
  margin-top: 0.8em;
  margin-bottom: 0.4em;
  line-height: 1.1;
}

.unified-editor :deep(.ProseMirror h2),
.collaborative-editor :deep(.ProseMirror h2) {
  font-size: 1.75em;
  font-weight: 700;
  margin-top: 0.7em;
  margin-bottom: 0.35em;
  line-height: 1.2;
}

.unified-editor :deep(.ProseMirror h3),
.collaborative-editor :deep(.ProseMirror h3) {
  font-size: 1.5em;
  font-weight: 600;
  margin-top: 0.6em;
  margin-bottom: 0.3em;
  line-height: 1.3;
}

/* Fix for cursor visibility in empty table cells */
.unified-editor :deep(.ProseMirror table td p),
.unified-editor :deep(.ProseMirror table th p),
.collaborative-editor :deep(.ProseMirror table td p),
.collaborative-editor :deep(.ProseMirror table th p) {
  min-height: 1.5em; /* Ensure empty cells have height */
  margin: 0;
}
</style>
