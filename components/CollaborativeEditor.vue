<script setup lang="ts">
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
import { Extension, Mark } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import ydocManager from '~/utils/ydocManager.client'

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
  addProseMirrorPlugins() {
    return [
      new Plugin({
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
                // The task item content starts after the checkbox (pos + 1)
                const contentStart = pos + 1
                const contentEnd = pos + node.nodeSize - 1

                newState.doc.nodesBetween(contentStart, contentEnd, (textNode, textPos) => {
                  if (textNode.isText) {
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
              }
            }
          })

          return modified ? tr : null
        }
      })
    ]
  }
})

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

// Modal states
const showLinkModal = ref(false)
const showImageModal = ref(false)
const linkUrl = ref('')
const imageUrl = ref('')

const props = withDefaults(defineProps<{
  noteId: string
  editable: boolean
  placeholder?: string
  userName?: string
  userColor?: string
  initialContent?: string
}>(), {
  placeholder: 'Start writing...',
  userName: 'Anonymous',
  userColor: '#3b82f6',
  initialContent: ''
})

const emit = defineEmits<{
  (e: 'update:content', content: string): void
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

console.log(`[CollabEditor ${props.noteId}] 🔧 Component created`)

// Get or create Y.Doc from singleton manager (prevents "Type already defined" errors)
const ydoc = ydocManager.getDoc(props.noteId)
console.log(`[CollabEditor ${props.noteId}] 📝 Y.Doc obtained from manager`)

// Initialize editor with collaboration - must be at top level
// Using individual extensions instead of StarterKit for better compatibility with Collaboration
const editor = useEditor({
  editable: props.editable,
  extensions: [
    // Core extensions
    Document,
    Paragraph,
    Text,
    // Collaboration extension
    Collaboration.configure({
      document: ydoc
    }),
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
    // Lists
    BulletList,
    OrderedList,
    ListItem,
    TaskList,
    TaskItemWithStrike.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex items-start gap-2'
      }
    }),
    // Links and images
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary-600 dark:text-primary-400 hover:underline cursor-pointer'
      }
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-lg my-4'
      }
    }),
    // Tables
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
    // Utilities
    Gapcursor,
    TableExit, // Custom extension for table navigation
    Placeholder.configure({
      placeholder: props.placeholder
    }),
    // User highlight for collaborative editing
    UserHighlight
  ]
})

console.log(`[CollabEditor ${props.noteId}] ✅ Editor initialized`)

// Watch for editable changes
watch(() => props.editable, (newValue) => {
  console.log(`[CollabEditor ${props.noteId}] 🔒 Editable changed: ${newValue}`)
  if (editor.value) {
    editor.value.setEditable(newValue)
  }
})

// Function to recalculate and update cursor position
function updateCursorPosition(editorInstance?: typeof editor.value) {
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
function updateCursorScreenPositions() {
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

  // Track cursor position for awareness and emit content updates
watch(editor, (editorInstance) => {
  if (!editorInstance) return
  
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

// Context menu handlers (matches regular editor)
function handleContextMenu(event: MouseEvent) {
  if (!props.editable) return
  
  event.preventDefault() // PREVENT system menu!
  
  // Calculate smart position for menu
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  
  // Estimated main menu height - COMPACT menu with only 4-5 items!
  // Each item ~42px + padding = ~220px total (with table options)
  const isInTable = editor.value?.isActive('table')
  const estimatedMenuHeight = isInTable ? 240 : 200 // Much smaller now!
  const menuWidth = 224 // w-56 = 224px
  
  let x = event.clientX
  let y = event.clientY
  
  // Check if menu would overflow bottom - position ABOVE cursor if needed
  const spaceBelow = viewportHeight - y
  const spaceAbove = y
  
  if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
    // Not enough space below, but more space above - position menu above cursor
    y = Math.max(8, y - estimatedMenuHeight)
  } else if (spaceBelow < estimatedMenuHeight) {
    // Not enough space either way, position at bottom with scroll
    y = Math.max(8, viewportHeight - estimatedMenuHeight - 8)
  }
  
  // Check if menu would overflow right side
  if (x + menuWidth > viewportWidth - 16) {
    x = Math.max(8, viewportWidth - menuWidth - 16)
  }
  
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

onMounted(() => {
  isMounted.value = true
  console.log(`[CollabEditor ${props.noteId}] 🚀 onMounted called`)
  
  // Close context menu on click outside
  if (process.client) {
    document.addEventListener('click', closeContextMenu)
  }
  
  if (!editor.value) {
    console.error(`[CollabEditor ${props.noteId}] ❌ No editor instance!`)
    return
  }

  console.log(`[CollabEditor ${props.noteId}] 🔌 Connecting to WebSocket: ${config.public.yjsWebsocketUrl}`)
  console.log(`[CollabEditor ${props.noteId}] 📡 Room: note-${props.noteId}`)
  
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
    console.log(`[CollabEditor ${props.noteId}] ✅ WebSocket provider created`)
    
    // Register provider with manager
    ydocManager.setProvider(props.noteId, provider.value)
  } catch (error) {
    console.error(`[CollabEditor ${props.noteId}] ❌ Failed to create provider:`, error)
    return
  }

  // Listen to connection status
  statusHandler = (event: { status: string }) => {
    if (isDestroying.value) return
    console.log(`[CollabEditor ${props.noteId}] 📶 Status changed: ${event.status}`)
    connectionStatus.value = event.status as any
  }
  provider.value.on('status', statusHandler)

  // Log when WebSocket opens
  connectHandler = () => {
    if (isDestroying.value) return
    console.log(`[CollabEditor ${props.noteId}] 🟢 WebSocket connected`)
  }
  provider.value.on('connect', connectHandler)

  disconnectHandler = () => {
    if (isDestroying.value) return
    console.log(`[CollabEditor ${props.noteId}] 🔴 WebSocket disconnected`)
  }
  provider.value.on('disconnect', disconnectHandler)

  // Initialize content from database if YJS doc is empty (first time sync)
  syncedHandler = () => {
    if (isDestroying.value) {
      console.log(`[CollabEditor ${props.noteId}] ⚠️ Synced event during destroy, ignoring`)
      return
    }
    
    console.log(`[CollabEditor ${props.noteId}] 🔄 Synced event fired`)
    
    try {
      // Don't try to initialize if already done - prevents race conditions
      if (isInitialized.value) {
        console.log(`[CollabEditor ${props.noteId}] ✅ Already initialized, skipping`)
        return
      }
      
      // Check if editor still exists
      if (!editor.value) {
        console.log(`[CollabEditor ${props.noteId}] ⚠️ Editor not available, skipping initialization`)
        return
      }
      
      // Check if editor has content by using the editor's state, NOT Y.Doc directly
      // This avoids the "Type already defined" error
      const editorIsEmpty = editor.value.isEmpty
      const editorText = editor.value.state.doc.textContent
      
      console.log(`[CollabEditor ${props.noteId}] 📏 Editor empty: ${editorIsEmpty}, text length: ${editorText.length}`)
      console.log(`[CollabEditor ${props.noteId}] 📦 Initial content length: ${props.initialContent?.length || 0}`)
      
      if (props.initialContent && editorIsEmpty) {
        // Only initialize if the editor is truly empty
        console.log(`[CollabEditor ${props.noteId}] 📝 Initializing editor with database content`)
        // Use emitUpdate: true to sync content to Y.Doc for other collaborators
        editor.value.commands.setContent(props.initialContent, { emitUpdate: true })
        console.log(`[CollabEditor ${props.noteId}] ✅ Content loaded and synced to Y.Doc`)
      } else if (!editorIsEmpty) {
        console.log(`[CollabEditor ${props.noteId}] ♻️ Editor already has content, skipping initialization`)
      } else {
        console.log(`[CollabEditor ${props.noteId}] ℹ️ No initial content to set`)
      }
      
      isInitialized.value = true
    } catch (error) {
      console.error(`[CollabEditor ${props.noteId}] ❌ Error in synced handler:`, error)
      // Mark as initialized to prevent retrying
      isInitialized.value = true
    }
  }
  provider.value.on('synced', syncedHandler)

  // Track Y.Doc updates for debugging
  updateHandler = (update: Uint8Array, origin: any) => {
    if (isDestroying.value) return
    
    try {
      // Don't access Y.Doc text directly - just log the update
      console.log(`[CollabEditor ${props.noteId}] 🔄 Y.Doc update received`, {
        updateSize: update.length,
        origin: origin?.constructor?.name || 'unknown',
        editorLength: editor.value?.state.doc.textContent.length || 0
      })
    } catch (error) {
      // Ignore errors during destruction
    }
  }
  ydoc.on('update', updateHandler)

  // Set up awareness for user presence
  if (provider.value.awareness) {
    // Broadcast our user info to other clients
    const updateUserAwareness = () => {
      if (provider.value?.awareness && !isDestroying.value) {
        provider.value.awareness.setLocalStateField('user', {
          name: props.userName,
          color: props.userColor,
          clientId: provider.value.awareness.clientID
        })
        console.log(`[CollabEditor ${props.noteId}] 📡 Broadcasting user presence: ${props.userName}`)
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
        
        console.log(`[CollabEditor ${props.noteId}] 👥 Connected users: ${count}`)
        console.log(`[CollabEditor ${props.noteId}] 👤 User list:`, 
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
  
  // Watch collaboratorCursors for position changes - fully reactive
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
    console.log(`[CollabEditor ${props.noteId}] 📏 ResizeObserver set up`)
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
})

onBeforeUnmount(() => {
  console.log(`[CollabEditor ${props.noteId}] 🧹 Starting cleanup...`)
  
  // Set flags first to prevent event handlers from firing
  isDestroying.value = true
  isMounted.value = false
  
  // Remove context menu listener
  if (process.client) {
    document.removeEventListener('click', closeContextMenu)
  }
  
  // Clean up in the correct order
  try {
    // 1. Remove all event listeners first!
    console.log(`[CollabEditor ${props.noteId}] 🔇 Removing event listeners...`)
    
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
      console.log(`[CollabEditor ${props.noteId}] 🚫 Clearing user presence`)
      provider.value.awareness.setLocalState(null)
    }
    
    // 3. Clear local provider reference (manager will handle actual destruction)
    provider.value = null
    
    // 4. Release Y.Doc reference to manager (will destroy if refCount reaches 0)
    console.log(`[CollabEditor ${props.noteId}] 📦 Releasing Y.Doc to manager`)
    ydocManager.releaseDoc(props.noteId)
    
    // 5. Destroy editor last
    if (editor.value) {
      console.log(`[CollabEditor ${props.noteId}] ✂️ Destroying editor`)
      editor.value.destroy()
    }
    
    console.log(`[CollabEditor ${props.noteId}] ✅ Cleanup complete`)
  } catch (error) {
    console.error(`[CollabEditor ${props.noteId}] ❌ Error during cleanup:`, error)
  }
})

// Method to get current HTML content (useful before unmounting or unsharing)
function getCurrentContent(): string {
  if (!editor.value) return ''
  try {
    return editor.value.getHTML()
  } catch (error) {
    console.error(`[CollabEditor ${props.noteId}] Error getting content:`, error)
    return ''
  }
}

// Expose connection status and getCurrentContent for parent components
defineExpose({
  connectionStatus,
  connectedUsers,
  getCurrentContent
})
</script>

<template>
  <div class="collaborative-editor w-full">
    <!-- Connection status indicator -->
    <div
      v-if="connectionStatus !== 'connected'"
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

    <!-- Connected users indicator with avatars -->
    <div
      v-else-if="connectedUsers > 1"
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
      <!-- Other users' cursors - shown at typing positions -->
      <template v-for="user in collaboratorCursors.filter(u => u.position !== undefined && (u.x !== undefined && u.y !== undefined))" :key="user.clientId">
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
        class="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none"
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
          <!-- Format Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['format'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('format')"
              @click.stop="toggleSubmenu('format')"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'format' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <span class="font-bold text-base">Aa</span>
              <span class="flex-1 text-left">Format</span>
              <span class="text-xs">›</span>
            </button>
          </div>

          <!-- Headings Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['headings'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('headings')"
              @click.stop="toggleSubmenu('headings')"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'headings' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <span class="text-lg font-bold">H</span>
              <span class="flex-1 text-left">Headings</span>
              <span class="text-xs">›</span>
            </button>
          </div>

          <!-- Lists Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['lists'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('lists')"
              @click.stop="toggleSubmenu('lists')"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'lists' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <span class="text-base">•</span>
              <span class="flex-1 text-left">Lists</span>
              <span class="text-xs">›</span>
            </button>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 my-1" />

          <!-- Insert Submenu -->
          <div class="relative">
            <button
              :ref="el => submenuButtonRefs['insert'] = el as HTMLElement"
              @mouseenter="toggleSubmenu('insert')"
              @click.stop="toggleSubmenu('insert')"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              :class="contextMenuSubmenu === 'insert' ? 'bg-gray-100 dark:bg-gray-700' : ''"
            >
              <span class="text-lg font-bold">+</span>
              <span class="flex-1 text-left">Insert</span>
              <span class="text-xs">›</span>
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

      <!-- Format Flyout -->
      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'format' && submenuButtonRefs['format']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{ bottom: `${getSubmenuPosition('format').bottom}px`, left: `${getSubmenuPosition('format').left}px` }"
          @click.stop
        >
          <button @click="editor?.chain().focus().toggleBold().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('bold') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'">
            <span class="font-bold w-5">B</span>
            <span class="flex-1 text-left">Bold</span>
            <span class="text-xs text-gray-400">⌘B</span>
          </button>
          <button @click="editor?.chain().focus().toggleItalic().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('italic') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'">
            <span class="italic w-5">I</span>
            <span class="flex-1 text-left">Italic</span>
            <span class="text-xs text-gray-400">⌘I</span>
          </button>
          <button @click="editor?.chain().focus().toggleUnderline().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('underline') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'">
            <span class="underline w-5">U</span>
            <span class="flex-1 text-left">Underline</span>
            <span class="text-xs text-gray-400">⌘U</span>
          </button>
          <button @click="editor?.chain().focus().toggleStrike().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('strike') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'">
            <span class="line-through w-5">S</span>
            <span class="flex-1 text-left">Strike</span>
          </button>
          <button @click="editor?.chain().focus().toggleCode().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('code') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-700 dark:text-gray-300'">
            <span class="font-mono text-xs w-5">&lt;/&gt;</span>
            <span class="flex-1 text-left">Code</span>
          </button>
        </div>
      </Transition>

      <!-- Headings Flyout -->
      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'headings' && submenuButtonRefs['headings']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{ bottom: `${getSubmenuPosition('headings').bottom}px`, left: `${getSubmenuPosition('headings').left}px` }"
          @click.stop
        >
          <button @click="editor?.chain().focus().toggleHeading({ level: 1 }).run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('heading', { level: 1 }) ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'">
            <span class="font-bold text-xs w-6">H1</span>
            <span class="flex-1 text-left">Heading 1</span>
          </button>
          <button @click="editor?.chain().focus().toggleHeading({ level: 2 }).run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('heading', { level: 2 }) ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'">
            <span class="font-bold text-xs w-6">H2</span>
            <span class="flex-1 text-left">Heading 2</span>
          </button>
          <button @click="editor?.chain().focus().toggleHeading({ level: 3 }).run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('heading', { level: 3 }) ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'">
            <span class="font-bold text-xs w-6">H3</span>
            <span class="flex-1 text-left">Heading 3</span>
          </button>
        </div>
      </Transition>

      <!-- Lists Flyout -->
      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'lists' && submenuButtonRefs['lists']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{ bottom: `${getSubmenuPosition('lists').bottom}px`, left: `${getSubmenuPosition('lists').left}px` }"
          @click.stop
        >
          <button @click="editor?.chain().focus().toggleBulletList().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('bulletList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'">
            <span class="w-5">•</span>
            <span class="flex-1 text-left">Bullet List</span>
          </button>
          <button @click="editor?.chain().focus().toggleOrderedList().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('orderedList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'">
            <span class="text-xs w-5">1.</span>
            <span class="flex-1 text-left">Numbered List</span>
          </button>
          <button @click="editor?.chain().focus().toggleTaskList().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="editor?.isActive('taskList') ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold' : 'text-gray-700 dark:text-gray-300'">
            <span class="w-5">☐</span>
            <span class="flex-1 text-left">Task List</span>
          </button>
        </div>
      </Transition>

      <!-- Insert Flyout -->
      <Transition name="context-menu">
        <div
          v-if="contextMenuSubmenu === 'insert' && submenuButtonRefs['insert']"
          class="fixed z-[10000] w-52 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl py-1"
          :style="{ bottom: `${getSubmenuPosition('insert').bottom}px`, left: `${getSubmenuPosition('insert').left}px` }"
          @click.stop
        >
          <button @click="setLink()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-sm w-5">🔗</span>
            <span class="flex-1 text-left">Link</span>
            <span class="text-xs text-gray-400">⌘K</span>
          </button>
          <button @click="addImage()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-sm w-5">🖼️</span>
            <span class="flex-1 text-left">Image</span>
          </button>
          <button @click="() => {
            // Insert table
            editor?.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
            closeContextMenu();
          }" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="text-xs w-5">⊞</span>
            <span class="flex-1 text-left">Table</span>
          </button>
          <button @click="editor?.chain().focus().toggleCodeBlock().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="font-mono text-xs w-5">{ }</span>
            <span class="flex-1 text-left">Code Block</span>
          </button>
          <button @click="editor?.chain().focus().toggleBlockquote().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="w-5">"</span>
            <span class="flex-1 text-left">Quote</span>
          </button>
          <button @click="editor?.chain().focus().setHorizontalRule().run(); closeContextMenu()" class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
            <span class="w-5">—</span>
            <span class="flex-1 text-left">Horizontal Rule</span>
          </button>
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
.collaborative-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 400px;
}

.collaborative-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

/* Heading Styles - Match regular editor */
.collaborative-editor :deep(.ProseMirror h1) {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 2.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
}

.collaborative-editor :deep(.ProseMirror h2) {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 2.25rem;
  margin-top: 1.5rem;
  margin-bottom: 0.875rem;
}

.collaborative-editor :deep(.ProseMirror h3) {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 2rem;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}

/* List Styles */
.collaborative-editor :deep(.ProseMirror ul),
.collaborative-editor :deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin: 1rem 0;
}

.collaborative-editor :deep(.ProseMirror ul) {
  list-style-type: disc;
}

.collaborative-editor :deep(.ProseMirror ol) {
  list-style-type: decimal;
}

.collaborative-editor :deep(.ProseMirror li) {
  margin: 0.25rem 0;
}

/* Code Block Styles - Notion-inspired */
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
}

.dark .collaborative-editor :deep(.ProseMirror pre) {
  background: #2e2e2e;
  color: #e8e8e8;
  border-color: #3e3e3e;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
}

.collaborative-editor :deep(.ProseMirror code) {
  background: #f1f5f9;
  color: #1e293b;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: 'JetBrainsMono', 'Courier New', Courier, monospace;
}

.dark .collaborative-editor :deep(.ProseMirror code) {
  background: #374151;
  color: #e5e7eb;
}

.collaborative-editor :deep(.ProseMirror pre code) {
  background: none;
  color: inherit;
  padding: 0;
  border: none;
}

/* Blockquote Styles */
.collaborative-editor :deep(.ProseMirror blockquote) {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
  color: #64748b;
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
</style>

