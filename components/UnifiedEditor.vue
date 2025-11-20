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
              const oldNode = oldState.doc.nodeAt(pos)
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
              event.preventDefault()
              slashCommandCallback()
              return true
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

// Using standard TaskItem (strike formatting removed for testing)
// No custom parseHTML needed - normalization function strips wrappers before parsing

// Track other users' cursors and typing positions
const collaboratorCursors = ref<Array<{ 
  name: string; 
  color: string; 
  clientId: number; 
  x?: number; 
  y?: number;
  position?: number; // Document position where user is typing
}>>([])

// Map to track user colors and names by client ID
const userMap = ref<Map<number, { name: string; color: string }>>(new Map())

// Context menu state (matches regular editor)
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuSubmenu = ref<string | null>(null)
const submenuButtonRefs = ref<{ [key: string]: HTMLElement | null }>({})
const editorContainer = ref<HTMLElement | null>(null)
const linkClickHandlerRef = ref<((event: MouseEvent) => void) | null>(null)

// Modal states
const showLinkModal = ref(false)
const showImageModal = ref(false)
const showYouTubeModal = ref(false)
const linkUrl = ref('')
const imageUrl = ref('')
const youtubeUrl = ref('')

const props = withDefaults(defineProps<{
  // Regular note props (v-model)
  modelValue?: string
  // Collaborative note props
  isCollaborative?: boolean
  noteId?: string
  editable?: boolean
  placeholder?: string
  userName?: string
  userColor?: string
  initialContent?: string
  // Additional props
  showToolbar?: boolean
  onAttachmentUpload?: (attachment: any) => void | Promise<void>
}>(), {
  modelValue: '',
  isCollaborative: false,
  noteId: undefined,
  editable: true,
  placeholder: 'Start writing...',
  userName: 'Anonymous',
  userColor: '#3b82f6',
  initialContent: '',
  showToolbar: true,
  onAttachmentUpload: undefined
})

const emit = defineEmits<{
  // For regular notes (v-model)
  (e: 'update:modelValue', value: string): void
  // For collaborative notes
  (e: 'update:content', content: string): void
  (e: 'update:showToolbar', value: boolean): void
  (e: 'attachment-uploaded', attachment: { id: number; file_name: string; file_path: string; mime_type: string | null; presigned_url?: string }): void
  (e: 'attachmentUploaded', attachment: { id: number; file_name: string; file_path: string; mime_type: string | null; presigned_url?: string }): void
}>()

const config = useRuntimeConfig()
const provider = ref<WebsocketProvider | null>(null)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>('connecting')
const connectedUsers = ref<number>(0)
const isInitialized = ref(false)
const isMounted = ref(false)
const isDestroying = ref(false)

// Store event handlers so we can remove them
let statusHandler: ((event: { status: string }) => void) | null = null
let connectHandler: (() => void) | null = null
let disconnectHandler: (() => void) | null = null
let syncedHandler: (() => void) | null = null
let updateHandler: ((update: Uint8Array, origin: any) => void) | null = null
let awarenessChangeHandler: (() => void) | null = null
let resizeObserverInstance: ResizeObserver | null = null
let resizeTimeout: NodeJS.Timeout | null = null


// CONDITIONAL: Only create Y.Doc if collaborative
const ydoc = props.isCollaborative && props.noteId
  ? ydocManager.getDoc(props.noteId)
  : null

if (props.isCollaborative && ydoc) {
}

// Build extensions array conditionally
const baseExtensions = [
  // Core extensions
  Document,
  Paragraph,
  Text,
  // Text formatting
  Bold,
  Italic,
  Strike,
  Underline,
  Code,
  // Block formatting
  Heading.configure({
    levels: [1, 2, 3]
  }),
  CodeBlock,
  Blockquote,
  HorizontalRule,
  HardBreak,
  // Lists - TaskList and TaskItem MUST come before BulletList to ensure input rules take precedence
  TaskList,
  TaskItemWithStrike.configure({
    nested: true,
    HTMLAttributes: {
      class: 'flex items-start gap-2'
    }
  }),
  BulletList.extend({
    addInputRules() {
      // Override to only match * - + and explicitly exclude [] patterns
      // This prevents conflict with TaskItem input rules
      return [
        {
          find: /^\s*([*\-+])\s$/,
          handler: ({ state, range, match, chain }: any) => {
            // Don't match if there's [] nearby
            const textBefore = state.doc.textBetween(Math.max(0, range.from - 5), range.from)
            if (textBefore.includes('[]') || textBefore.includes('[ ]') || textBefore.includes('[x]')) {
              return false
            }
            
            return chain()
              .deleteRange({ from: range.from, to: range.to })
              .toggleBulletList()
              .run()
          }
        }
      ]
    }
  }),
  OrderedList,
  ListItem,
  // Links and images
  Link.extend({
    addProseMirrorPlugins() {
      return [
        ...(this.parent?.() || []),
        new Plugin({
          key: new PluginKey('linkClickHandler'),
          props: {
            handleDOMEvents: {
              click: (view, event) => {
                const target = event.target as HTMLElement
                let link: HTMLAnchorElement | null = null
                
                if (target.tagName === 'A') {
                  link = target as HTMLAnchorElement
                } else {
                  link = target.closest('a')
                }
                
                if (link && link.href) {
                  // If Ctrl/Cmd is held, allow default behavior (editing in editable mode)
                  if (event.ctrlKey || event.metaKey) {
                    return false
                  }
                  
                  // Prevent default and open in new tab
                  event.preventDefault()
                  event.stopPropagation()
                  
                  let href = link.href
                  if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:') && !href.startsWith('#')) {
                    href = 'https://' + href
                  }
                  
                  window.open(href, '_blank', 'noopener,noreferrer')
                  return true
                }
                
                return false
              }
            }
          }
        })
      ]
    }
  }).configure({
    openOnClick: true,
    HTMLAttributes: {
      class: 'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer'
    },
    // Enable keyboard shortcuts (only for regular notes, collaborative uses Y.Doc)
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
  Image.configure({
    HTMLAttributes: {
      class: 'max-w-2xl w-full h-auto rounded-lg my-4 mx-auto block'
    },
    inline: false,
    allowBase64: true
  }),
  YouTube.configure({
    HTMLAttributes: {
      class: 'youtube-embed'
    }
  }),
  // Tables
  Table.configure({
    resizable: true,
    allowTableNodeSelection: true,
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
  // Utilities
  Gapcursor,
  TableExit,
  MarkdownPaste, // Custom extension for markdown paste support
  SlashCommand, // Custom extension for slash commands
  Placeholder.configure({
    placeholder: props.placeholder || 'Start writing...'
  }),
]

// CONDITIONAL: Add History extension only for non-collaborative notes
// (Collaborative editing uses Y.Doc's own history mechanism)
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
  },
  editorProps: {
    attributes: {
      spellcheck: 'true'
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

// Handle slash command (/) to show formatting menu - Notion style
watch(editor, (editorInstance) => {
  if (!editorInstance) return
  
  // Store editor instance for markdown paste
  editorInstanceForPaste = editorInstance
  
  // Register global callback for slash command
  slashCommandCallback = () => {
    if (!editorInstance) {
      return
    }
    
    // Only trigger if not in code block
    if (editorInstance.isActive('codeBlock')) {
      return
    }
    
    // Get cursor position for menu placement
    const { from } = editorInstance.state.selection
    const coords = editorInstance.view.coordsAtPos(from)
    
    // Show formatting menu - works anywhere like Notion
    if (showContextMenu.value) {
      closeContextMenu()
    } else {
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const menuWidth = 224
      // Updated height for 7 insert items (Link, Image, YouTube, Table, Code Block, Quote, Horizontal Rule)
      const estimatedMenuHeight = 280
      
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
    }
  }
}, { immediate: true })

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
  if (!props.isCollaborative) return
  if (!editor.value || !editorContainer.value || isDestroying.value) return
  
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
}

// Context menu handlers (matches regular editor)
function handleContextMenu(event: MouseEvent) {
  if (!props.editable) return
  
  // Allow native menu temporarily for spell check
  if (allowNativeSpellCheck.value) {
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

function getSubmenuPosition(buttonKey: string) {
  const button = submenuButtonRefs.value[buttonKey]
  if (!button) return { top: 0, left: 0, bottom: 'auto' }
  
  const rect = button.getBoundingClientRect()
  const submenuWidth = 208 // w-52 = 208px
  
  // Different heights for different submenus
  const submenuHeights: Record<string, number> = {
    'format': 200,
    'headings': 160, // Reduced from 280 after removing H4, H5, H6
    'lists': 140,
    'insert': 280,
    'table': 240
  }
  const submenuHeight = submenuHeights[buttonKey] || 200
  
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // Calculate left position (prefer right side)
  let left = rect.right + 4
  if (left + submenuWidth > viewportWidth - 16) {
    left = rect.left - submenuWidth - 4
  }
  
  // Position submenu to align with the button
  // Use bottom of button as reference point
  const bottom = viewportHeight - rect.bottom // Distance from bottom of viewport to bottom of button
  
  return {
    bottom,
    left,
    top: 'auto' as const
  }
}

// Formatting handlers
function applyInlineCode() {
  if (!editor.value) return
  // Toggle code mark - works with or without selection
  editor.value.chain().focus().toggleCode().run()
  closeContextMenu()
}

// Link handlers
function setLink() {
  const previousUrl = editor.value?.getAttributes('link').href
  linkUrl.value = previousUrl || ''
  showLinkModal.value = true
  closeContextMenu()
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
  closeContextMenu()
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
  closeContextMenu()
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
      // No word found, just focus the editor
      editor.value.chain().focus().run()
    }
  } else {
    // There's already a selection
    const selectedText = editor.value.state.doc.textBetween(from, to)
    
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

onMounted(() => {
  isMounted.value = true
  console.log(`[UnifiedEditor ${props.noteId || 'no-id'}] 🚀 onMounted called, collaborative: ${props.isCollaborative}`)
  
  // Close context menu on click outside
  if (process.client) {
    document.addEventListener('click', closeContextMenu)
  }
  
  if (!editor.value) {
    console.error(`[UnifiedEditor ${props.noteId || 'no-id'}] ❌ No editor instance!`)
    return
  }

  // Add link click handler (fallback)
  nextTick(() => {
    if (editor.value) {
      const editorElement = editor.value.view.dom
      
      linkClickHandlerRef.value = (event: MouseEvent) => {
        const target = event.target as HTMLElement
        let link: HTMLAnchorElement | null = null
        
        if (target.tagName === 'A') {
          link = target as HTMLAnchorElement
        } else {
          link = target.closest('a')
        }
        
        if (link && link.href) {
          // If Ctrl/Cmd is held, allow default behavior (editing in editable mode)
          if (event.ctrlKey || event.metaKey) {
            return
          }
          
          // Prevent default and open in new tab
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          
          let href = link.href
          if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:') && !href.startsWith('#')) {
            href = 'https://' + href
          }
          
          window.open(href, '_blank', 'noopener,noreferrer')
        }
      }
      
      if (linkClickHandlerRef.value) {
        editorElement.addEventListener('click', linkClickHandlerRef.value, true)
        console.log(`[UnifiedEditor ${props.noteId || 'no-id'}] ✅ Link click handler attached`)
      }
    }
  })

  // CONDITIONAL: Only set up WebSocket if collaborative
  if (props.isCollaborative && props.noteId && ydoc) {
    console.log(`[UnifiedEditor ${props.noteId}] 🔌 Connecting to WebSocket: ${config.public.yjsWebsocketUrl}`)
    console.log(`[UnifiedEditor ${props.noteId}] 📡 Room: note-${props.noteId}`)
    
    // Connect to WebSocket provider
    try {
      provider.value = new WebsocketProvider(
        config.public.yjsWebsocketUrl as string,
        `note-${props.noteId}`, // Room name is the noteId
        ydoc,
        {
          params: {
            user: props.userName,
            color: props.userColor
          }
        }
      )
      console.log(`[UnifiedEditor ${props.noteId}] ✅ WebSocket provider created`)
      
      // Register provider with manager
      ydocManager.setProvider(props.noteId, provider.value)
    } catch (error) {
      console.error(`[UnifiedEditor ${props.noteId}] ❌ Failed to create provider:`, error)
      return
    }
  } else {
    console.log(`[UnifiedEditor ${props.noteId || 'no-id'}] ℹ️ Regular note mode - no WebSocket needed`)
  }

    // CONDITIONAL: Only set up event handlers if collaborative
    if (provider.value) {
      // Listen to connection status
      statusHandler = (event: { status: string }) => {
        if (isDestroying.value) return
        console.log(`[UnifiedEditor ${props.noteId}] 📶 Status changed: ${event.status}`)
        connectionStatus.value = event.status as any
      }
      provider.value.on('status', statusHandler)

      // Log when WebSocket opens
      connectHandler = () => {
        if (isDestroying.value) return
        console.log(`[UnifiedEditor ${props.noteId}] 🟢 WebSocket connected`)
      }
      provider.value.on('connect', connectHandler)

      disconnectHandler = () => {
        if (isDestroying.value) return
        console.log(`[UnifiedEditor ${props.noteId}] 🔴 WebSocket disconnected`)
      }
      provider.value.on('disconnect', disconnectHandler)
    }

      // Initialize content from database if YJS doc is empty (first time sync)
      // CRITICAL: Use Y.Doc config map to track initialization (prevents overwriting collaborative content)
      syncedHandler = async () => {
        if (isDestroying.value) {
          console.log(`[UnifiedEditor ${props.noteId}] ⚠️ Synced event during destroy, ignoring`)
          return
        }
        
        console.log(`[UnifiedEditor ${props.noteId}] 🔄 Synced event fired`)
    
        try {
          // Check if editor still exists
          if (!editor.value || !ydoc) {
            console.log(`[UnifiedEditor ${props.noteId}] ⚠️ Editor or Y.Doc not available, skipping initialization`)
            return
          }
          
          // Use Y.Doc config map to track if initial content was already loaded (prevents overwriting)
          // This is the recommended approach from Tiptap collaboration docs
          const config = ydoc.getMap('config')
          const initialContentLoaded = config.get('initialContentLoaded')
          
          // CRITICAL: Even if initialContentLoaded is true, check if Y.Doc actually has meaningful content
          // This prevents skipping initialization when Y.Doc has empty/stale content
          if (initialContentLoaded) {
            // Check if editor actually has content (especially task lists)
            const editorIsEmpty = editor.value.isEmpty
            const editorText = editor.value.state.doc.textContent.trim()
            const editorHTML = editor.value.getHTML()
            const editorHasTaskList = editorHTML && (
              editorHTML.includes('data-type="taskList') ||
              editorHTML.includes("data-type='taskList")
            )
            
            // Check if initial content has task lists
            const initialHasTaskList = props.initialContent && (
              props.initialContent.includes('data-type="taskList') ||
              props.initialContent.includes("data-type='taskList") ||
              (props.initialContent.includes('<ul') && props.initialContent.includes('taskList'))
            )
            
            // If editor is empty or missing task lists that should be there, force re-initialize
            const shouldForceReinit = (editorIsEmpty || editorText.length === 0) && 
                                     props.initialContent && 
                                     props.initialContent.trim().length > 0
            
            const shouldForceTaskListReinit = initialHasTaskList && !editorHasTaskList && 
                                             props.initialContent && 
                                             props.initialContent.trim().length > 0
            
            if (shouldForceReinit || shouldForceTaskListReinit) {
              console.log(`[UnifiedEditor ${props.noteId}] ⚠️ Y.Doc config says initialized but editor is empty/missing task lists - FORCE RE-INITIALIZING`, {
                editorIsEmpty,
                editorTextLength: editorText.length,
                initialHasTaskList,
                editorHasTaskList,
                shouldForceReinit,
                shouldForceTaskListReinit
              })
              // Reset the flag so we can initialize
              config.set('initialContentLoaded', false)
              // Don't return - continue with initialization below
            } else {
              console.log(`[UnifiedEditor ${props.noteId}] ✅ Initial content already loaded (from Y.Doc config), editor has content`)
              isInitialized.value = true
              return
            }
          }
          
          // Check if editor has meaningful content (more than just empty paragraph)
          // For task lists, we need to check HTML structure, not just textContent
          // because task lists can have structure but minimal text
          const editorIsEmpty = editor.value.isEmpty
          const editorText = editor.value.state.doc.textContent.trim()
          const editorHTML = editor.value.getHTML()
          
          // Check if initial content has task lists (critical for preserving checkbox content)
          const initialHasTaskList = props.initialContent && (
            props.initialContent.includes('data-type="taskList') ||
            props.initialContent.includes("data-type='taskList") ||
            props.initialContent.includes('<ul') && props.initialContent.includes('taskList')
          )
          
          // Check if there's actual HTML structure (not just empty paragraphs)
          // Task lists have structure like <ul data-type="taskList"> even if text is minimal
          const hasHTMLStructure = editorHTML && (
            editorHTML.length > 20 || // More than just <p></p>
            editorHTML.includes('<ul') || 
            editorHTML.includes('<ol') ||
            editorHTML.includes('data-type="taskList') ||
            editorHTML.includes('<h') ||
            editorHTML.includes('<blockquote') ||
            editorHTML.includes('<table')
          )
          const hasTextContent = editorText.length > 0
          const hasContent = hasTextContent || hasHTMLStructure
          
          // Check if editor has task lists
          const editorHasTaskList = editorHTML && (
            editorHTML.includes('data-type="taskList') ||
            editorHTML.includes("data-type='taskList")
          )
          
          console.log(`[UnifiedEditor ${props.noteId}] 📏 Editor state:`, {
            isEmpty: editorIsEmpty,
            textLength: editorText.length,
            htmlLength: editorHTML.length,
            hasTextContent,
            hasHTMLStructure,
            hasContent,
            initialHasTaskList,
            editorHasTaskList,
            initialContentLength: props.initialContent?.length || 0,
            htmlPreview: editorHTML.substring(0, 100)
          })
          
          // Helper function to normalize task list HTML for TipTap parsing
          // CRITICAL: TipTap TaskItem parser expects content DIRECTLY in <li>, not in wrapper divs
          // When parsing: <li data-type="taskItem" data-checked="false"><p>content</p></li>
          // When rendering: TipTap adds <label> and <div> wrappers automatically
          // So we must STRIP wrappers for parsing, TipTap will add them back when rendering
          function normalizeTaskListHTML(html: string): string {
            if (!html || !html.includes('data-type="taskList')) {
              return html
            }
            
            try {
              console.log(`[UnifiedEditor ${props.noteId}] 🔧 Normalizing task list HTML, original length:`, html.length)
              
              // Create a temporary DOM element to parse and normalize
              const temp = document.createElement('div')
              temp.innerHTML = html
              
              // Find all task items and ensure they have the correct structure
              const taskItems = temp.querySelectorAll('li[data-type="taskItem"]')
              console.log(`[UnifiedEditor ${props.noteId}] 🔧 Found ${taskItems.length} task items to normalize`)
              
              taskItems.forEach((item, index) => {
                // Get the checked state from data-checked attribute
                const checked = item.getAttribute('data-checked') === 'true'
                
                // Find wrapper div and label
                const wrapperDiv = item.querySelector('div')
                const label = item.querySelector('label')
                
                // Extract content from wrapper div (this is where the actual text is)
                let content = ''
                if (wrapperDiv) {
                  content = wrapperDiv.innerHTML.trim()
                  console.log(`[UnifiedEditor ${props.noteId}] 🔧 Task item ${index} - extracted from wrapper div:`, content.substring(0, 50))
                } else {
                  // No wrapper div - check if content is directly in li
                  // Remove label to see what's left
                  const tempClone = item.cloneNode(true) as HTMLElement
                  const labelClone = tempClone.querySelector('label')
                  if (labelClone) {
                    labelClone.remove()
                  }
                  content = tempClone.innerHTML.trim()
                  console.log(`[UnifiedEditor ${props.noteId}] 🔧 Task item ${index} - extracted from li (no wrapper):`, content.substring(0, 50))
                }
                
                // If no content found, try to get text content
                if (!content || content === '<p></p>' || content === '') {
                  const allText = item.textContent?.trim() || ''
                  // Remove checkbox label text if present
                  const labelText = label?.textContent?.trim() || ''
                  let textContent = allText
                  if (labelText && allText.includes(labelText)) {
                    textContent = allText.replace(labelText, '').trim()
                  }
                  if (textContent) {
                    content = `<p>${textContent}</p>`
                    console.log(`[UnifiedEditor ${props.noteId}] 🔧 Task item ${index} - extracted from text:`, textContent.substring(0, 50))
                  } else {
                    content = '<p></p>'
                  }
                }
                
                // CRITICAL: Strip ALL wrapper elements (label, div) and put content directly in <li>
                // TipTap expects: <li data-type="taskItem" data-checked="false"><p>content</p></li>
                // It will add the wrappers when rendering, but they confuse the parser
                item.innerHTML = content
                
                // Ensure data-checked attribute is set (TipTap reads this, not the checkbox)
                item.setAttribute('data-checked', checked ? 'true' : 'false')
                
                // Remove any class attributes that might interfere with parsing
                // TipTap will add its own classes when rendering
                item.removeAttribute('class')
                
                console.log(`[UnifiedEditor ${props.noteId}] 🔧 Task item ${index} - normalized to:`, item.outerHTML.substring(0, 100))
              })
              
              const normalized = temp.innerHTML
              console.log(`[UnifiedEditor ${props.noteId}] 🔧 Normalized HTML length:`, normalized.length, 'original:', html.length)
              console.log(`[UnifiedEditor ${props.noteId}] 🔧 Normalized preview:`, normalized.substring(0, 200))
              
              return normalized
            } catch (error) {
              console.error(`[UnifiedEditor ${props.noteId}] Error normalizing task list HTML:`, error)
              return html // Return original if normalization fails
            }
          }
          
          // Normalize initial content if it has task lists
          let normalizedContent = props.initialContent
          if (initialHasTaskList && props.initialContent) {
            normalizedContent = normalizeTaskListHTML(props.initialContent)
            if (normalizedContent !== props.initialContent) {
              console.log(`[UnifiedEditor ${props.noteId}] 🔧 Normalized task list HTML to remove wrapper elements`)
            }
          }
          
          // CRITICAL: If initial content has task lists but editor doesn't, always initialize
          // This prevents task list content from being lost
          if (initialHasTaskList && !editorHasTaskList && normalizedContent && normalizedContent.trim().length > 0) {
            console.log(`[UnifiedEditor ${props.noteId}] ⚠️ Task list detected in initial content but missing in editor - FORCE INITIALIZING`)
            console.log(`[UnifiedEditor ${props.noteId}] ⚠️ Normalized content preview:`, normalizedContent.substring(0, 200))
            
            editor.value.commands.setContent(normalizedContent, { emitUpdate: true })
            
            // Verify the content was actually set - check immediately after
            await nextTick()
            const afterSetHTML = editor.value.getHTML()
            const afterSetHasTaskList = afterSetHTML.includes('data-type="taskList')
            
            console.log(`[UnifiedEditor ${props.noteId}] ⚠️ After setContent:`, {
              htmlLength: afterSetHTML.length,
              hasTaskList: afterSetHasTaskList,
              htmlPreview: afterSetHTML.substring(0, 200)
            })
            
            if (!afterSetHasTaskList) {
              console.error(`[UnifiedEditor ${props.noteId}] ❌ CRITICAL: Task list was stripped during setContent!`)
              console.error(`[UnifiedEditor ${props.noteId}] Original normalized:`, normalizedContent.substring(0, 500))
              console.error(`[UnifiedEditor ${props.noteId}] After setContent:`, afterSetHTML.substring(0, 500))
            }
            
            config.set('initialContentLoaded', true)
            isInitialized.value = true
            return
          }
          
          // Only set initial content if:
          // 1. Editor is truly empty (no text content AND no HTML structure)
          // 2. We have initial content from database
          // 3. Initial content hasn't been loaded before (tracked in Y.Doc config)
          if (hasContent) {
            // Y.Doc already has content (from another client or previous session)
            // But check if it matches the initial content - if not, we should initialize
            // For task lists, be more strict about matching (check for task list markers)
            const contentMatches = editorHTML === normalizedContent || 
                                   editorHTML === props.initialContent ||
                                   (editorHTML.length < 50 && normalizedContent && normalizedContent.length > 50) ||
                                   (initialHasTaskList && editorHasTaskList && Math.abs(editorHTML.length - (normalizedContent?.length || 0)) < 100)
            
            if (!contentMatches && normalizedContent && normalizedContent.trim().length > 0) {
              // Content doesn't match - likely Y.Doc has stale/empty content
              // Initialize with database content (normalized)
              console.log(`[UnifiedEditor ${props.noteId}] 🔄 Content mismatch, initializing with database content`, {
                editorHTMLLength: editorHTML.length,
                initialContentLength: props.initialContent?.length || 0,
                normalizedContentLength: normalizedContent.length,
                initialHasTaskList,
                editorHasTaskList,
                normalizedPreview: normalizedContent.substring(0, 200)
              })
              
              editor.value.commands.setContent(normalizedContent, { emitUpdate: true })
              
              // Verify the content was actually set - check immediately after
              await nextTick()
              const afterSetHTML = editor.value.getHTML()
              const afterSetHasTaskList = afterSetHTML.includes('data-type="taskList')
              
              console.log(`[UnifiedEditor ${props.noteId}] 🔄 After setContent:`, {
                htmlLength: afterSetHTML.length,
                hasTaskList: afterSetHasTaskList,
                htmlPreview: afterSetHTML.substring(0, 200)
              })
              
              if (initialHasTaskList && !afterSetHasTaskList) {
                console.error(`[UnifiedEditor ${props.noteId}] ❌ CRITICAL: Task list was stripped during setContent!`)
                console.error(`[UnifiedEditor ${props.noteId}] Original normalized:`, normalizedContent.substring(0, 500))
                console.error(`[UnifiedEditor ${props.noteId}] After setContent:`, afterSetHTML.substring(0, 500))
              }
              
              config.set('initialContentLoaded', true)
              isInitialized.value = true
              return
            }
            
            // Mark as initialized and trust Y.Doc's content
            console.log(`[UnifiedEditor ${props.noteId}] 📦 Y.Doc already has content, trusting collaborative state`)
            config.set('initialContentLoaded', true)
            isInitialized.value = true
            return
          }
          
          // Editor is empty, check if we should initialize from database
          if (normalizedContent && normalizedContent.trim().length > 0) {
            console.log(`[UnifiedEditor ${props.noteId}] 📝 Initializing editor with database content (first time)`)
            console.log(`[UnifiedEditor ${props.noteId}] 📝 Normalized content preview:`, normalizedContent.substring(0, 200))
            
            // Set content with emitUpdate: true to sync to Y.Doc for other collaborators
            editor.value.commands.setContent(normalizedContent, { emitUpdate: true })
            
            // Verify the content was actually set - check immediately after
            await nextTick()
            const afterSetHTML = editor.value.getHTML()
            const afterSetHasTaskList = afterSetHTML.includes('data-type="taskList')
            
            // Check TipTap's internal document structure to see if it parsed as taskItems
            const doc = editor.value.state.doc
            let taskItemCount = 0
            let listItemCount = 0
            doc.descendants((node) => {
              if (node.type.name === 'taskItem') {
                taskItemCount++
              } else if (node.type.name === 'listItem') {
                listItemCount++
              }
            })
            
            console.log(`[UnifiedEditor ${props.noteId}] 📝 After setContent:`, {
              htmlLength: afterSetHTML.length,
              hasTaskList: afterSetHasTaskList,
              htmlPreview: afterSetHTML.substring(0, 200),
              taskItemNodes: taskItemCount,
              listItemNodes: listItemCount,
              docStructure: doc.content.content.map(n => ({ type: n.type.name, attrs: n.attrs }))
            })
            
            if (taskItemCount === 0 && initialHasTaskList) {
              console.error(`[UnifiedEditor ${props.noteId}] ❌ CRITICAL: TipTap parsed task lists as regular list items!`)
              console.error(`[UnifiedEditor ${props.noteId}] Task items found: ${taskItemCount}, List items found: ${listItemCount}`)
              console.error(`[UnifiedEditor ${props.noteId}] Original normalized:`, normalizedContent.substring(0, 500))
              console.error(`[UnifiedEditor ${props.noteId}] After setContent HTML:`, afterSetHTML.substring(0, 500))
            }
            
            if (initialHasTaskList && !afterSetHasTaskList) {
              console.error(`[UnifiedEditor ${props.noteId}] ❌ CRITICAL: Task list was stripped during setContent!`)
              console.error(`[UnifiedEditor ${props.noteId}] Original normalized:`, normalizedContent.substring(0, 500))
              console.error(`[UnifiedEditor ${props.noteId}] After setContent:`, afterSetHTML.substring(0, 500))
            }
            
            // Mark as initialized in Y.Doc config map (prevents re-initialization)
            config.set('initialContentLoaded', true)
            
            console.log(`[UnifiedEditor ${props.noteId}] ✅ Content loaded and synced to Y.Doc`)
          } else {
            console.log(`[UnifiedEditor ${props.noteId}] ℹ️ No initial content to set, marking as initialized`)
            config.set('initialContentLoaded', true)
          }
          
          isInitialized.value = true
        } catch (error) {
          console.error(`[UnifiedEditor ${props.noteId}] ❌ Error in synced handler:`, error)
          // Mark as initialized to prevent retrying
          isInitialized.value = true
          // Also mark in Y.Doc config to prevent retries
          if (ydoc) {
            try {
              ydoc.getMap('config').set('initialContentLoaded', true)
            } catch (e) {
              // Ignore config errors
            }
          }
        }
      }
    if (provider.value) {
      provider.value.on('synced', syncedHandler)
    }

    // Track Y.Doc updates for debugging and ensure updates are reflected (only if collaborative)
    if (ydoc) {
      updateHandler = (update: Uint8Array, origin: any) => {
        if (isDestroying.value) return
        
        try {
          // Log the update for debugging
          const editorLength = editor.value?.state.doc.textContent.length || 0
          const isLocalUpdate = origin === editor.value || origin?.constructor?.name === 'Collaboration'
          
          console.log(`[UnifiedEditor ${props.noteId}] 🔄 Y.Doc update received`, {
            updateSize: update.length,
            origin: origin?.constructor?.name || 'unknown',
            editorLength,
            isLocalUpdate
          })
          
          // If this is a remote update (not from our editor), ensure UI reflects it
          // The Collaboration extension should handle this automatically, but we can verify
          if (!isLocalUpdate && editor.value) {
            // Wait a tick to ensure Collaboration extension has processed the update
            nextTick(() => {
              if (editor.value && !isDestroying.value) {
                const newContent = editor.value.getHTML()
                // Emit update to ensure parent component knows content changed
                emit('update:content', newContent)
              }
            })
          }
        } catch (error) {
          console.error(`[UnifiedEditor ${props.noteId}] ❌ Error handling Y.Doc update:`, error)
        }
      }
      ydoc.on('update', updateHandler)
    }

    // Set up awareness for user presence (only if collaborative)
    if (provider.value?.awareness) {
    // Broadcast our user info to other clients
    const updateUserAwareness = () => {
      if (provider.value?.awareness && !isDestroying.value) {
          provider.value.awareness.setLocalStateField('user', {
            name: props.userName,
            color: props.userColor,
            clientId: provider.value.awareness.clientID
          })
          console.log(`[UnifiedEditor ${props.noteId}] 📡 Broadcasting user presence: ${props.userName}`)
      }
    }
    
    // Set initial user awareness
    updateUserAwareness()
    
    // Watch for prop changes and update awareness (important when switching spaces/users)
    watch([() => props.userName, () => props.userColor], () => {
      updateUserAwareness()
    }, { immediate: false })
    
    // Track connected users via awareness
    awarenessChangeHandler = () => {
      if (isDestroying.value) return
      if (provider.value?.awareness && editor.value) {
        const myClientId = provider.value.awareness.clientID
        const states = provider.value.awareness.getStates()
        const count = states.size
        
        // Build list of other users (exclude self) with cursor positions
        const otherUsers: Array<{ 
          name: string; 
          color: string; 
          clientId: number; 
          x?: number; 
          y?: number;
          position?: number;
        }> = []
        
        // Clear user map and rebuild from current states to avoid stale entries
        userMap.value.clear()
        
        // Update user map and build other users list
        states.forEach((state: any, clientId: number) => {
          // Only process states that have valid user information
          if (state.user && state.user.name && state.user.color) {
            // Update user map for all users (including self for reference)
            userMap.value.set(clientId, {
              name: state.user.name,
              color: state.user.color
            })
            
            // Only add other users (not self) to collaborator cursors
            if (clientId !== myClientId) {
              const docPosition = state.cursor?.position
              let screenX = state.cursor?.x
              let screenY = state.cursor?.y
              
              // If we have document position but not screen position, calculate it
              if (docPosition !== undefined && editor.value) {
                try {
                  const coords = editor.value.view.coordsAtPos(docPosition)
                  const editorEl = editorContainer.value
                  
                  if (editorEl && coords) {
                    const editorRect = editorEl.getBoundingClientRect()
                    screenX = coords.left - editorRect.left + editorEl.scrollLeft
                    screenY = coords.top - editorRect.top + editorEl.scrollTop
                  }
                } catch (err) {
                  // Use provided screen position or undefined
                }
              }
              
              otherUsers.push({
                name: state.user.name,
                color: state.user.color,
                clientId,
                x: screenX,
                y: screenY,
                position: docPosition
              })
            }
          }
        })
        
        collaboratorCursors.value = otherUsers
        
          console.log(`[UnifiedEditor ${props.noteId}] 👥 Connected users: ${count}`)
          console.log(`[UnifiedEditor ${props.noteId}] 👤 User list:`, 
            Array.from(states.values()).map((state: any) => state.user?.name)
          )
        connectedUsers.value = count
      }
    }

    // Wrap awareness handler to update cursor positions
    const wrappedAwarenessHandler = () => {
      awarenessChangeHandler()
      // Update screen positions immediately after awareness updates
      updateCursorScreenPositions()
    }
    
      provider.value.awareness.on('change', wrappedAwarenessHandler)
      wrappedAwarenessHandler() // Initial count
    }
    
    // Watch collaboratorCursors for position changes - fully reactive (only if collaborative)
    if (props.isCollaborative) {
      watch(
        () => collaboratorCursors.value.map(u => u.position),
        () => {
          // Update screen positions when document positions change
          updateCursorScreenPositions()
        },
        { deep: true, flush: 'sync' }
      )
      
      // Set up ResizeObserver to recalculate cursor positions when editor container resizes
      // This handles cases where the sidebar width changes, causing the editor to resize
      const setupResizeObserver = () => {
        if (!process.client || !editorContainer.value || !editor.value || resizeObserverInstance) return
    
    resizeObserverInstance = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        // Recalculate cursor position when container resizes
        // This ensures cursor positions are correct after sidebar toggle
        updateCursorPosition()
        
        // Also trigger a view update to force ProseMirror to recalculate positions
        if (editor.value) {
          editor.value.view.dom.dispatchEvent(new Event('resize'))
        }
      }, 150) // 150ms debounce to allow for smooth transitions
    })
    
        resizeObserverInstance.observe(editorContainer.value)
        console.log(`[UnifiedEditor ${props.noteId}] 📏 ResizeObserver set up`)
      }
      
      // Try to set up immediately, then watch for editorContainer availability
      nextTick(() => {
        setupResizeObserver()
        
        // Also watch editorContainer in case it becomes available later
        watch(editorContainer, (newVal) => {
          if (newVal && editor.value && !resizeObserverInstance) {
            setupResizeObserver()
          }
        }, { immediate: true })
      })
    }
})

onBeforeUnmount(() => {
  console.log(`[UnifiedEditor ${props.noteId || 'no-id'}] 🧹 Starting cleanup...`)
  
  // Set flags first to prevent event handlers from firing
  isDestroying.value = true
  isMounted.value = false
  
  // Remove context menu listener
  if (process.client) {
    document.removeEventListener('click', closeContextMenu)
  }
  
  // Clean up in the correct order (only if collaborative)
  if (props.isCollaborative) {
    try {
      // 1. Remove all event listeners first!
      console.log(`[UnifiedEditor ${props.noteId}] 🔇 Removing event listeners...`)
      
      if (provider.value) {
        if (statusHandler) provider.value.off('status', statusHandler)
        if (connectHandler) provider.value.off('connect', connectHandler)
        if (disconnectHandler) provider.value.off('disconnect', disconnectHandler)
        if (syncedHandler) provider.value.off('synced', syncedHandler)
        
        if (provider.value.awareness && awarenessChangeHandler) {
          provider.value.awareness.off('change', awarenessChangeHandler)
        }
      }
      
      if (ydoc && updateHandler) {
        ydoc.off('update', updateHandler)
      }
    
    // Clean up ResizeObserver
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
      resizeTimeout = null
    }
    if (resizeObserverInstance) {
      if (editorContainer.value) {
        resizeObserverInstance.unobserve(editorContainer.value)
      }
      resizeObserverInstance.disconnect()
      resizeObserverInstance = null
    }
    
    console.log(`[CollabEditor ${props.noteId}] ✅ Event listeners removed`)
    
      // 2. Clear awareness state before disconnecting
      if (provider.value?.awareness) {
        console.log(`[UnifiedEditor ${props.noteId}] 🚫 Clearing user presence`)
        provider.value.awareness.setLocalState(null)
      }
      
      // 3. Clear local provider reference (manager will handle actual destruction)
      provider.value = null
      
      // 4. Release Y.Doc reference to manager (will destroy if refCount reaches 0)
      if (props.noteId && ydoc) {
        console.log(`[UnifiedEditor ${props.noteId}] 📦 Releasing Y.Doc to manager`)
        ydocManager.releaseDoc(props.noteId)
      }
    } catch (error) {
      console.error(`[UnifiedEditor ${props.noteId}] ❌ Error during cleanup:`, error)
    }
  }
  
  // 5. Destroy editor last (for both modes)
  if (editor.value) {
    console.log(`[UnifiedEditor ${props.noteId || 'no-id'}] ✂️ Destroying editor`)
    editor.value.destroy()
  }
  
  console.log(`[UnifiedEditor ${props.noteId || 'no-id'}] ✅ Cleanup complete`)
})

// Note: getCurrentContent and getHTML are already exposed above
</script>

<template>
  <div class="unified-editor w-full" :class="{ 'collaborative-editor': isCollaborative }">
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
        <div
          v-for="user in collaboratorCursors"
          :key="user.clientId"
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-white dark:ring-gray-800 shadow-sm"
          :style="{ backgroundColor: user.color }"
          :title="user.name"
        >
          {{ user.name.charAt(0).toUpperCase() }}
        </div>
      </div>
    </div>

    <!-- Editor content -->
    <div ref="editorContainer" class="relative" @contextmenu="handleContextMenu">
      <!-- Other users' cursors - shown at typing positions (only for collaborative notes) -->
      <template v-if="isCollaborative" v-for="user in collaboratorCursors.filter(u => u.position !== undefined && (u.x !== undefined && u.y !== undefined))" :key="user.clientId">
        <div
          class="absolute pointer-events-none z-40 transition-all duration-150"
          :style="{ 
            left: user.x + 'px', 
            top: user.y + 'px',
            transform: 'translateY(-2px)'
          }"
        >
          <div class="flex items-center gap-1">
            <div
              class="w-0.5 h-5 animate-pulse"
              :style="{ backgroundColor: user.color }"
            ></div>
            <div
              class="px-1.5 py-0.5 rounded text-xs font-medium text-white shadow-sm whitespace-nowrap"
              :style="{ backgroundColor: user.color }"
            >
              {{ user.name }}
            </div>
          </div>
        </div>
      </template>

      <EditorContent
        :editor="editor"
        class="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none min-h-[400px] p-4"
      />
      
      <!-- Hidden file input for file uploads -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- Context Menu - Notion Style (Compact) -->
    <Teleport to="body">
      <Transition name="context-menu">
        <div
          v-if="showContextMenu"
          class="fixed z-[9999] w-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }"
          @click.stop
        >
          <!-- Insert Options (now primary menu) -->
          <button @click="setLink(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-sm w-5">🔗</span>
            <span class="flex-1 text-left">Link</span>
            <span class="text-xs text-gray-400">⌘K</span>
          </button>
          <button @click="addImage(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-sm w-5">🖼️</span>
            <span class="flex-1 text-left">Image</span>
          </button>
          <button @click="addYouTube(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-sm w-5">📹</span>
            <span class="flex-1 text-left">YouTube Video</span>
          </button>
          <button @click="() => {
            editor?.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
            closeContextMenu();
          }" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-xs w-5">⊞</span>
            <span class="flex-1 text-left">Table</span>
          </button>
          <button @click="() => { if (editor) { editor.chain().focus().setCodeBlock().run(); } closeContextMenu(); }" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="font-mono text-xs w-5">{ }</span>
            <span class="flex-1 text-left">Code Block</span>
          </button>
          <button @click="() => { if (editor) { editor.chain().focus().setBlockquote().run(); } closeContextMenu(); }" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="w-5">"</span>
            <span class="flex-1 text-left">Quote</span>
          </button>
          <button @click="editor?.chain().focus().setHorizontalRule().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="w-5">—</span>
            <span class="flex-1 text-left">Horizontal Rule</span>
          </button>

          <!-- Table Controls (only show when in a table) -->
          <template v-if="editor?.isActive('table')">
            <div class="border-t border-gray-200 dark:border-gray-700 my-1" />
            <div class="relative">
              <button
                :ref="el => submenuButtonRefs['table'] = el as HTMLElement"
                @mouseenter="toggleSubmenu('table')"
                @click.stop="toggleSubmenu('table')"
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-medium"
                :class="contextMenuSubmenu === 'table' ? 'bg-primary-100 dark:bg-primary-900/30' : ''"
              >
                <span class="text-sm">⊞</span>
                <span class="flex-1 text-left">Table Options</span>
                <span class="text-xs">›</span>
              </button>
            </div>
          </template>
        </div>
      </Transition>

      <!-- Table Flyout -->
      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'table' && submenuButtonRefs['table']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{ bottom: `${getSubmenuPosition('table').bottom}px`, left: `${getSubmenuPosition('table').left}px` }"
          @click.stop
        >
          <button @click="editor?.chain().focus().addRowBefore().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span>↑</span>
            <span class="flex-1 text-left">Add Row Above</span>
          </button>
          <button @click="editor?.chain().focus().addRowAfter().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span>↓</span>
            <span class="flex-1 text-left">Add Row Below</span>
          </button>
          <button @click="editor?.chain().focus().addColumnBefore().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span>←</span>
            <span class="flex-1 text-left">Add Column Left</span>
          </button>
          <button @click="editor?.chain().focus().addColumnAfter().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span>→</span>
            <span class="flex-1 text-left">Add Column Right</span>
          </button>
          <div class="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button @click="editor?.chain().focus().deleteRow().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400">
            <span>🗑</span>
            <span class="flex-1 text-left">Delete Row</span>
          </button>
          <button @click="editor?.chain().focus().deleteColumn().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400">
            <span>🗑</span>
            <span class="flex-1 text-left">Delete Column</span>
          </button>
          <button @click="editor?.chain().focus().deleteTable().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400">
            <span>🗑</span>
            <span class="flex-1 text-left">Delete Table</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Link Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showLinkModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
          @click="cancelLink"
        >
          <div
            @click.stop
            class="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Insert Link
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter the URL you want to link to
            </p>
            <input
              v-model="linkUrl"
              type="url"
              placeholder="https://example.com"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6"
              @keyup.enter="confirmLink"
              autofocus
            />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="cancelLink">
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
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
          @click="cancelImage"
        >
          <div
            @click.stop
            class="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Insert Image
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter the image URL
            </p>
            <input
              v-model="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6"
              @keyup.enter="confirmImage"
              autofocus
            />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="cancelImage">
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

    <!-- YouTube Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showYouTubeModal"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
          @click="cancelYouTube"
        >
          <div
            @click.stop
            class="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
          >
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Insert YouTube Video
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Enter the YouTube video URL or embed URL
            </p>
            <input
              v-model="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-6"
              @keyup.enter="confirmYouTube"
              autofocus
            />
            <div class="flex gap-3">
              <UButton color="neutral" variant="soft" block @click="cancelYouTube">
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

<style scoped>
/* Context Menu Transition */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.2s ease;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95) translateY(20px);
}

/* Tiptap Editor Styles */
.unified-editor :deep(.ProseMirror),
.collaborative-editor :deep(.ProseMirror) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
  min-height: 400px;
  /* Ensure caret is visible on mobile */
  caret-color: #1f2937 !important;
}

.dark .unified-editor :deep(.ProseMirror),
.dark .collaborative-editor :deep(.ProseMirror) {
  caret-color: #e5e7eb !important;
}

.unified-editor :deep(.ProseMirror:focus),
.collaborative-editor :deep(.ProseMirror:focus) {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.collaborative-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Heading Styles - Apply to both unified-editor and collaborative-editor */
.unified-editor :deep(.ProseMirror h1),
.collaborative-editor :deep(.ProseMirror h1) {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 2.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  display: block;
}

.unified-editor :deep(.ProseMirror h2),
.collaborative-editor :deep(.ProseMirror h2) {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 2.25rem;
  margin-top: 1.5rem;
  margin-bottom: 0.875rem;
  display: block;
}

.unified-editor :deep(.ProseMirror h3),
.collaborative-editor :deep(.ProseMirror h3) {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 2rem;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
  display: block;
}

/* List Styles - Apply to both unified-editor and collaborative-editor */
.unified-editor :deep(.ProseMirror ul),
.unified-editor :deep(.ProseMirror ol),
.collaborative-editor :deep(.ProseMirror ul),
.collaborative-editor :deep(.ProseMirror ol),
.unified-editor :deep(.ProseMirror ul[data-type="bulletList"]),
.unified-editor :deep(.ProseMirror ol[data-type="orderedList"]),
.collaborative-editor :deep(.ProseMirror ul[data-type="bulletList"]),
.collaborative-editor :deep(.ProseMirror ol[data-type="orderedList"]) {
  padding-left: 1.625rem !important;
  margin-top: 0.75rem !important;
  margin-bottom: 0.75rem !important;
  list-style-position: outside !important;
  display: block !important;
}

/* Task lists should NOT have bullet points */
.unified-editor :deep(.ProseMirror ul[data-type="taskList"]),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"]) {
  list-style-type: none !important;
  list-style: none !important;
  padding-left: 0 !important;
  margin-left: 0 !important;
}

/* Task items should display inline with checkbox, not as separate lines */
.unified-editor :deep(.ProseMirror li[data-type="taskItem"]),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"]),
.unified-editor :deep(.ProseMirror ul[data-type="taskList"] li),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li) {
  display: flex !important;
  align-items: center !important;
  list-style: none !important;
  margin: 0.25rem 0 !important;
  padding-left: 0 !important;
  gap: 0.5rem !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
}

/* Override any block display on task items */
.unified-editor :deep(.ProseMirror li[data-type="taskItem"]),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"]) {
  display: flex !important;
}

/* Task item label (contains checkbox) */
.unified-editor :deep(.ProseMirror li[data-type="taskItem"] label),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] label),
.unified-editor :deep(.ProseMirror ul[data-type="taskList"] li label),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li label) {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  flex-shrink: 0 !important;
  min-width: auto !important;
  width: auto !important;
}

/* Task item checkbox input */
.unified-editor :deep(.ProseMirror li[data-type="taskItem"] input[type="checkbox"]),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] input[type="checkbox"]),
.unified-editor :deep(.ProseMirror ul[data-type="taskList"] li input[type="checkbox"]),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li input[type="checkbox"]) {
  margin: 0 !important;
  margin-right: 0 !important;
  flex-shrink: 0 !important;
  width: auto !important;
  height: auto !important;
}

/* Task item content wrapper (div) - Tiptap wraps content in a div */
.unified-editor :deep(.ProseMirror li[data-type="taskItem"] > div),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] > div),
.unified-editor :deep(.ProseMirror ul[data-type="taskList"] li > div),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li > div) {
  display: flex !important;
  align-items: center !important;
  flex: 1 1 auto !important;
  margin: 0 !important;
  padding: 0 !important;
  min-width: 0 !important;
  width: auto !important;
}

/* Ensure task item content (paragraph) is inline */
.unified-editor :deep(.ProseMirror li[data-type="taskItem"] p),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] p),
.unified-editor :deep(.ProseMirror li[data-type="taskItem"] > div > p),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] > div > p),
.unified-editor :deep(.ProseMirror li[data-type="taskItem"] > p),
.collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] > p),
.unified-editor :deep(.ProseMirror ul[data-type="taskList"] li p),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li p),
.unified-editor :deep(.ProseMirror ul[data-type="taskList"] li > div > p),
.collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li > div > p) {
  display: inline !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.5 !important;
  width: auto !important;
  vertical-align: baseline !important;
  /* Ensure caret is visible on mobile after checkbox creation */
  caret-color: #1f2937 !important;
}

.dark .unified-editor :deep(.ProseMirror li[data-type="taskItem"] p),
.dark .collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] p),
.dark .unified-editor :deep(.ProseMirror li[data-type="taskItem"] > div > p),
.dark .collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] > div > p),
.dark .unified-editor :deep(.ProseMirror li[data-type="taskItem"] > p),
.dark .collaborative-editor :deep(.ProseMirror li[data-type="taskItem"] > p),
.dark .unified-editor :deep(.ProseMirror ul[data-type="taskList"] li p),
.dark .collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li p),
.dark .unified-editor :deep(.ProseMirror ul[data-type="taskList"] li > div > p),
.dark .collaborative-editor :deep(.ProseMirror ul[data-type="taskList"] li > div > p) {
  caret-color: #e5e7eb !important;
}

.unified-editor :deep(.ProseMirror ul),
.unified-editor :deep(.ProseMirror ul[data-type="bulletList"]),
.collaborative-editor :deep(.ProseMirror ul),
.collaborative-editor :deep(.ProseMirror ul[data-type="bulletList"]) {
  list-style-type: disc !important;
}

.unified-editor :deep(.ProseMirror ol),
.unified-editor :deep(.ProseMirror ol[data-type="orderedList"]),
.collaborative-editor :deep(.ProseMirror ol),
.collaborative-editor :deep(.ProseMirror ol[data-type="orderedList"]) {
  list-style-type: decimal !important;
}

.unified-editor :deep(.ProseMirror li:not([data-type="taskItem"])),
.unified-editor :deep(.ProseMirror li[data-type="listItem"]),
.collaborative-editor :deep(.ProseMirror li:not([data-type="taskItem"])),
.collaborative-editor :deep(.ProseMirror li[data-type="listItem"]) {
  margin-top: 0.25rem !important;
  margin-bottom: 0.25rem !important;
  display: list-item !important;
  list-style-position: outside !important;
  padding-left: 0 !important;
}

/* Ensure list items have proper spacing */
.unified-editor :deep(.ProseMirror li:not([data-type="taskItem"]) > p),
.unified-editor :deep(.ProseMirror li[data-type="listItem"] > p),
.collaborative-editor :deep(.ProseMirror li:not([data-type="taskItem"]) > p),
.collaborative-editor :deep(.ProseMirror li[data-type="listItem"] > p) {
  margin-top: 0;
  margin-bottom: 0;
}

/* Code Block Styles - Notion-inspired - Apply to both unified-editor and collaborative-editor */
.unified-editor :deep(.ProseMirror pre),
.collaborative-editor :deep(.ProseMirror pre) {
  background: #f7f6f3;
  color: #37352f;
  font-family: 'JetBrainsMono', 'Courier New', Courier, monospace;
  padding: 1rem 1.25rem;
  border-radius: 0.375rem;
  margin: 1rem 0;
  overflow-x: auto;
  border: 1px solid #e9e9e7;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  display: block;
  white-space: pre;
}

.dark .unified-editor :deep(.ProseMirror pre),
.dark .collaborative-editor :deep(.ProseMirror pre) {
  background: #2e2e2e;
  color: #e8e8e8;
  border-color: #3e3e3e;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
}

.unified-editor :deep(.ProseMirror code),
.collaborative-editor :deep(.ProseMirror code) {
  background: #f1f5f9;
  color: #1e293b;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'JetBrainsMono', 'Courier New', Courier, monospace;
}

.dark .unified-editor :deep(.ProseMirror code),
.dark .collaborative-editor :deep(.ProseMirror code) {
  background: #374151;
  color: #e5e7eb;
}

.unified-editor :deep(.ProseMirror pre code),
.collaborative-editor :deep(.ProseMirror pre code) {
  background: none;
  color: inherit;
  padding: 0;
  border: none;
}

/* Fix whitespace rendering in code blocks - prevent spaces/tabs from having different backgrounds */
.unified-editor :deep(.ProseMirror pre),
.collaborative-editor :deep(.ProseMirror pre) {
  tab-size: 2;
  -moz-tab-size: 2;
}

/* Remove any background styling from all elements inside code blocks */
.unified-editor :deep(.ProseMirror pre *),
.collaborative-editor :deep(.ProseMirror pre *),
.unified-editor :deep(.ProseMirror pre code *),
.collaborative-editor :deep(.ProseMirror pre code *) {
  background: transparent !important;
  background-color: transparent !important;
}

.dark .unified-editor :deep(.ProseMirror pre *),
.dark .collaborative-editor :deep(.ProseMirror pre *),
.dark .unified-editor :deep(.ProseMirror pre code *),
.dark .collaborative-editor :deep(.ProseMirror pre code *) {
  background: transparent !important;
  background-color: transparent !important;
}

/* Ensure spans and other inline elements don't have backgrounds */
.unified-editor :deep(.ProseMirror pre span),
.collaborative-editor :deep(.ProseMirror pre span),
.unified-editor :deep(.ProseMirror pre code span),
.collaborative-editor :deep(.ProseMirror pre code span) {
  background: transparent !important;
  background-color: transparent !important;
}

.dark .unified-editor :deep(.ProseMirror pre span),
.dark .collaborative-editor :deep(.ProseMirror pre span),
.dark .unified-editor :deep(.ProseMirror pre code span),
.dark .collaborative-editor :deep(.ProseMirror pre code span) {
  background: transparent !important;
  background-color: transparent !important;
}

/* Blockquote Styles - Apply to both unified-editor and collaborative-editor */
.unified-editor :deep(.ProseMirror blockquote),
.collaborative-editor :deep(.ProseMirror blockquote) {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
  color: #64748b;
  display: block;
}

.dark .unified-editor :deep(.ProseMirror blockquote),
.dark .collaborative-editor :deep(.ProseMirror blockquote) {
  border-left-color: #60a5fa;
  color: #9ca3af;
}

/* Gapcursor Styles - Make it visible and clickable after tables */
.collaborative-editor :deep(.ProseMirror-gapcursor) {
  display: block;
  pointer-events: none;
  position: relative;
}

.collaborative-editor :deep(.ProseMirror-gapcursor:after) {
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
.collaborative-editor :deep(.ProseMirror table) {
  margin-bottom: 2rem !important;
  margin-right: 1rem !important;
  width: calc(100% - 1rem) !important; /* Leave space on the right */
}

.collaborative-editor :deep(.ProseMirror table + *) {
  margin-top: 1rem;
}

/* Collaboration cursor styles */
.collaborative-editor :deep(.collaboration-cursor__caret) {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

.collaborative-editor :deep(.collaboration-cursor__label) {
  border-radius: 3px 3px 3px 0;
  color: #0d0d0d;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}

/* User Highlight Text - fade from user color to normal */
.collaborative-editor :deep(.user-highlight-text) {
  animation: fadeToNormal 2s ease-out forwards;
  will-change: color;
}

@keyframes fadeToNormal {
  from {
    /* Color stays at user color initially */
  }
  to {
    color: inherit !important;
  }
}

/* Dark mode support for user highlight */
.dark .collaborative-editor :deep(.user-highlight-text) {
  animation: fadeToNormalDark 2s ease-out forwards;
}

@keyframes fadeToNormalDark {
  from {
    /* Color stays at user color initially */
  }
  to {
    color: #e5e7eb !important; /* Default dark mode text color */
  }
}

/* YouTube embed styles */
.collaborative-editor :deep(.ProseMirror .youtube-wrapper) {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  height: 0;
  overflow: hidden;
  max-width: 100%;
  margin: 1.5rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
}

.collaborative-editor :deep(.ProseMirror .youtube-wrapper iframe) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

/* Image sizing - prevent huge images */
.unified-editor :deep(.ProseMirror img),
.collaborative-editor :deep(.ProseMirror img) {
  max-width: 42rem !important; /* max-w-2xl equivalent */
  width: 100% !important;
  height: auto !important;
  display: block !important;
  margin-left: auto !important;
  margin-right: auto !important;
  border-radius: 0.5rem;
  margin-top: 1rem !important;
  margin-bottom: 1rem !important;
}

/* Ensure images don't exceed container width on mobile */
@media (max-width: 768px) {
  .unified-editor :deep(.ProseMirror img),
  .collaborative-editor :deep(.ProseMirror img) {
    max-width: 100% !important;
  }
}

</style>

