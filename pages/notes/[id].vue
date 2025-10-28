<script setup lang="ts">
import type { UpdateNoteDto } from '~/models';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const toast = useToast();

// Network status
const { isOnline } = useNetworkStatus();

const noteId = computed(() => parseInt(route.params.id as string));
const isSaving = ref(false);
const isLoading = ref(true);
const autoSaveTimeout = ref<NodeJS.Timeout | null>(null);
const showShortcuts = ref(false);
const showDeleteModal = ref(false);
const isDeleting = ref(false);
const isLocked = ref(false);

const editForm = reactive<UpdateNoteDto & { content: string }>({
  title: '',
  content: '',
  tags: [],
  folder: ''
});

const currentNote = computed(() => notesStore.currentNote);

// Character and word count
const wordCount = computed(() => {
  if (!editForm.content) return 0;
  return editForm.content.trim().split(/\s+/).filter(word => word.length > 0).length;
});

const charCount = computed(() => {
  return editForm.content?.length || 0;
});

// Fetch note on mount
onMounted(async () => {
  isLoading.value = true;
  try {
    await notesStore.fetchNote(noteId.value);
    if (currentNote.value) {
      Object.assign(editForm, {
        title: currentNote.value.title,
        content: currentNote.value.content || '',
        tags: currentNote.value.tags || [],
        folder: currentNote.value.folder || ''
      });
    }
    
    // Load lock state from localStorage
    if (process.client) {
      const savedLockState = localStorage.getItem(`note-${noteId.value}-locked`);
      if (savedLockState === 'true') {
        isLocked.value = true;
      }
    }
    
    // Small delay to prevent flash
    await new Promise(resolve => setTimeout(resolve, 300));
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to load note',
      color: 'error'
    });
    router.push('/dashboard');
  } finally {
    isLoading.value = false;
  }
});

// Auto-save on content change (only when not locked)
watch([() => editForm.title, () => editForm.content, () => editForm.folder], () => {
  if (isLocked.value) return; // Don't auto-save when locked
  
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
  }
  
  autoSaveTimeout.value = setTimeout(() => {
    saveNote(true);
  }, 1000); // Auto-save after 1 second of inactivity
});

// Toggle lock state
function toggleLock() {
  isLocked.value = !isLocked.value;
  
  // Save lock state to localStorage
  if (process.client) {
    localStorage.setItem(`note-${noteId.value}-locked`, isLocked.value.toString());
  }
  
  if (isLocked.value) {
    toast.add({
      title: 'Note Locked',
      description: 'Read-only mode activated',
      color: 'success'
    });
  } else {
    toast.add({
      title: 'Note Unlocked',
      description: 'You can now edit this note',
      color: 'success'
    });
  }
}

async function saveNote(silent = false) {
  if (!editForm.title?.trim()) {
    if (!silent) {
      toast.add({
        title: 'Validation Error',
        description: 'Title is required',
        color: 'error'
      });
    }
    return;
  }

  isSaving.value = true;

  try {
    // Prepare the data to send
    const updateData: UpdateNoteDto = {
      title: editForm.title,
      content: editForm.content,
      tags: editForm.tags || [],
      folder: editForm.folder || null
    };
    
    console.log('Saving note with data:', updateData);
    
    await notesStore.updateNote(noteId.value, updateData);
    if (!silent) {
      toast.add({
        title: 'Success',
        description: 'Note saved',
        color: 'success'
      });
    }
  } catch (error) {
    console.error('Save error:', error);
    if (!silent) {
      toast.add({
        title: 'Error',
        description: 'Failed to save note',
        color: 'error'
      });
    }
  } finally {
    isSaving.value = false;
  }
}

function deleteNote() {
  showDeleteModal.value = true;
}

async function confirmDelete() {
  isDeleting.value = true;

  try {
    await notesStore.deleteNote(noteId.value);
    toast.add({
      title: 'Success',
      description: 'Note deleted',
      color: 'success'
    });
    showDeleteModal.value = false;
    router.push('/dashboard');
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to delete note',
      color: 'error'
    });
  } finally {
    isDeleting.value = false;
  }
}

function cancelDelete() {
  showDeleteModal.value = false;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Handle tags input
const tagInput = ref('');

function addTag() {
  const trimmedTag = tagInput.value.trim();
  if (!trimmedTag) return;
  
  // Ensure tags is an array
  if (!editForm.tags || editForm.tags === null) {
    editForm.tags = [];
  }
  
  // Check if tag already exists
  if (editForm.tags.includes(trimmedTag)) {
    tagInput.value = '';
    return;
  }
  
  // Add the tag
  editForm.tags = [...editForm.tags, trimmedTag];
  tagInput.value = '';
  
  // Save immediately
  saveNote(true);
}

function removeTag(tag: string) {
  if (editForm.tags && editForm.tags.length > 0) {
    // Create a new array to trigger reactivity
    editForm.tags = editForm.tags.filter(t => t !== tag);
    saveNote(true);
  }
}

// Cleanup auto-save timeout
onUnmounted(() => {
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
  }
});
</script>

<template>
  <div class="min-h-screen" :class="isLocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'">
    <!-- Top Navigation Bar -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="flex items-center justify-between h-16 px-4 md:px-6">
        <!-- Left: Back Button & Logo -->
        <div class="flex items-center gap-3">
          <UButton
            icon="i-heroicons-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="router.push('/dashboard')"
          />
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center shadow-lg">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
            </div>
            <h1 class="text-lg font-bold text-gray-900 dark:text-white hidden md:block">Notes</h1>
          </div>
        </div>

        <!-- Right: Note Actions -->
        <div class="flex items-center gap-2">
          <!-- Save Status -->
          <div v-if="!isOnline" class="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
            <UIcon name="i-heroicons-wifi" class="w-4 h-4" />
            <span class="hidden sm:inline">Offline</span>
          </div>
          <div v-else-if="isSaving" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span class="hidden sm:inline">Saving...</span>
          </div>
          <div v-else class="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span class="hidden sm:inline">Saved</span>
          </div>
          
          <!-- Lock/Unlock Button -->
          <UButton
            :icon="isLocked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'"
            :color="isLocked ? 'warning' : 'neutral'"
            variant="ghost"
            size="sm"
            @click="toggleLock"
            :title="isLocked ? 'Unlock Note (Enable Editing)' : 'Lock Note (Read-Only)'"
          />
          
          <!-- Keyboard Shortcuts -->
          <UButton
            icon="i-heroicons-question-mark-circle"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="showShortcuts = true"
            title="Keyboard Shortcuts"
          />
          
          <!-- Delete -->
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            @click="deleteNote"
          />
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 animate-spin mx-auto text-primary-600 mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading note...</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Please wait a moment</p>
      </div>
    </div>

    <!-- Editor Container -->
    <div v-else>
      <!-- Note Header (Title & Stats) -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-6">
        <div class="max-w-5xl mx-auto">
          <!-- Locked State: Read-only title -->
          <h1
            v-if="isLocked"
            class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3"
          >
            {{ editForm.title || 'Untitled Note' }}
          </h1>
          <!-- Unlocked State: Editable title -->
          <input
            v-else
            v-model="editForm.title"
            type="text"
            class="w-full bg-transparent border-none outline-none text-3xl md:text-4xl font-bold text-gray-900 dark:text-white placeholder-gray-400 mb-3"
            placeholder="Untitled Note"
          />
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span v-if="isLocked" class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <UIcon name="i-heroicons-lock-closed" class="w-3.5 h-3.5" />
              Read-Only Mode
            </span>
            <span v-if="currentNote" class="flex items-center gap-1">
              <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
              {{ formatDate(currentNote.updated_at) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5" />
              {{ wordCount }} words
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-chart-bar" class="w-3.5 h-3.5" />
              {{ charCount }} characters
            </span>
          </div>
        </div>
      </div>

      <!-- Metadata Bar (Hidden when locked) -->
      <div v-if="!isLocked" class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-4 text-sm flex-wrap">
            <!-- Folder -->
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-folder" class="w-4 h-4 text-gray-400" />
              <div class="relative">
                <input
                  v-model="editForm.folder"
                  type="text"
                  list="folder-suggestions"
                  class="bg-transparent border-none outline-none text-gray-600 dark:text-gray-400 placeholder-gray-400 w-40"
                  placeholder="No folder"
                />
                <datalist id="folder-suggestions">
                  <option v-for="folder in notesStore.folders" :key="folder" :value="folder" />
                </datalist>
              </div>
            </div>

            <!-- Tags -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div class="flex items-center gap-1 flex-wrap">
                <UBadge
                  v-for="tag in editForm.tags"
                  :key="tag"
                  color="primary"
                  variant="soft"
                  size="xs"
                  class="cursor-pointer hover:bg-primary-200 dark:hover:bg-primary-800"
                  @click="removeTag(tag)"
                >
                  {{ tag }}
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1" />
                </UBadge>
                <input
                  v-model="tagInput"
                  type="text"
                  class="bg-transparent border-none outline-none text-gray-600 dark:text-gray-400 placeholder-gray-400 text-sm w-24"
                  placeholder="Add tag..."
                  @keyup.enter="addTag"
                  @blur="addTag"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Tags Display (Read-only when locked) -->
      <div v-else-if="editForm.tags && editForm.tags.length > 0" class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-3">
        <div class="max-w-5xl mx-auto">
          <div class="flex items-center gap-3 text-sm flex-wrap">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-folder" class="w-4 h-4 text-gray-400" />
              <span class="text-gray-600 dark:text-gray-400">{{ editForm.folder || 'No folder' }}</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <UIcon name="i-heroicons-tag" class="w-4 h-4 text-gray-400" />
              <UBadge
                v-for="tag in editForm.tags"
                :key="tag"
                color="primary"
                variant="soft"
                size="xs"
              >
                {{ tag }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- WYSIWYG Editor Area -->
      <div class="pb-20" :class="isLocked ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'">
        <div class="max-w-5xl mx-auto py-6 px-4 md:px-6">
          <ClientOnly>
            <TiptapEditor
              v-model="editForm.content"
              placeholder="Start writing..."
              :editable="!isLocked"
            />
          </ClientOnly>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showShortcuts"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="showShortcuts = false"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <button
                @click="showShortcuts = false"
                class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <!-- Shortcuts List -->
            <div class="space-y-4">
              <!-- Formatting -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Formatting</h4>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Bold</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ B</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Italic</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ I</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Code</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ E</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Link</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ K</kbd>
                  </div>
                </div>
              </div>

              <!-- Headings -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Headings</h4>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Heading 1-6</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ ⌥ 1-6</kbd>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Actions</h4>
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Undo</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ Z</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Redo</span>
                    <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">⌘ ⇧ Z</kbd>
                  </div>
                </div>
              </div>

                <!-- Insert -->
                <div>
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Insert</h4>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">Image</span>
                      <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Image icon</kbd>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">Table</span>
                      <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Table icon</kbd>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">Add/delete columns/rows</span>
                      <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Toolbar buttons</kbd>
                    </div>
                  </div>
                </div>
              </div>

            <!-- Footer Tip -->
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                💡 Tip: Use the toolbar above the editor for formatting
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="cancelDelete"
          />
          
          <!-- Modal -->
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <!-- Icon -->
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-error-100 dark:bg-error-900/30 rounded-full">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>

            <!-- Title -->
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Delete Note?
            </h3>

            <!-- Description -->
            <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Are you sure you want to delete 
              <span class="font-semibold text-gray-900 dark:text-white">"{{ editForm.title }}"</span>? 
              This action cannot be undone.
            </p>

            <!-- Actions -->
            <div class="flex gap-3">
              <UButton
                color="neutral"
                variant="soft"
                block
                @click="cancelDelete"
                :disabled="isDeleting"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                block
                @click="confirmDelete"
                :loading="isDeleting"
                :disabled="isDeleting"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}

/* Remove input autofill background */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px white inset;
  transition: background-color 5000s ease-in-out 0s;
}

.dark input:-webkit-autofill,
.dark input:-webkit-autofill:hover,
.dark input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px #1f2937 inset;
  -webkit-text-fill-color: #f3f4f6;
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
