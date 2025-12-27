<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useKanbanStore } from '~/stores/kanban';
import { useToast } from '~/composables/useToast';
import type { KanbanCard, CreateKanbanCardDto } from '~/models/Kanban';
import Sortable from 'sortablejs';
import AddNoteModal from '~/components/AddNoteModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const kanbanStore = useKanbanStore();
const toast = useToast();

const isMounted = ref(false);
const showViewDropdown = ref(false);

const columnRefs = ref(new Map<string, HTMLElement>());

// Modal states
const showAddNoteModal = ref(false);
const newNoteStatus = ref('backlog');
const cardToEdit = ref<KanbanCard | null>(null);

// Delete card confirmation
const showDeleteCardModal = ref(false);
const cardToDelete = ref<number | null>(null);

// Delete completed confirmation
const showDeleteCompletedModal = ref(false);

const columns = [
  { 
    id: 'backlog', 
    title: 'Backlog', 
    headerIcon: 'i-heroicons-list-bullet',
    bgClass: 'bg-gray-50 dark:bg-gray-800/40',
    headerBgClass: 'bg-gray-100 dark:bg-gray-800',
    accentColor: 'text-gray-600 dark:text-gray-400',
    barColor: 'bg-gray-300 dark:bg-gray-600',
    buttonClass: 'text-gray-600 bg-gray-200/50 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700/50 dark:hover:bg-gray-700'
  },
  { 
    id: 'in_progress', 
    title: 'In Progress', 
    headerIcon: 'i-heroicons-play-circle',
    bgClass: 'bg-blue-50 dark:bg-blue-900/10',
    headerBgClass: 'bg-blue-100/50 dark:bg-blue-900/30',
    accentColor: 'text-blue-600 dark:text-blue-400',
    barColor: 'bg-blue-300 dark:bg-blue-700',
    buttonClass: 'text-blue-600 bg-blue-100/50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50'
  },
  { 
    id: 'in_review', 
    title: 'In Review', 
    headerIcon: 'i-heroicons-eye',
    bgClass: 'bg-amber-50 dark:bg-amber-900/10',
    headerBgClass: 'bg-amber-100/50 dark:bg-amber-900/30',
    accentColor: 'text-amber-600 dark:text-amber-400',
    barColor: 'bg-amber-300 dark:bg-amber-700',
    buttonClass: 'text-amber-600 bg-amber-100/50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 dark:hover:bg-amber-900/50'
  },
  { 
    id: 'completed', 
    title: 'Completed', 
    headerIcon: 'i-heroicons-check-circle',
    bgClass: 'bg-green-50 dark:bg-green-900/10',
    headerBgClass: 'bg-green-100/50 dark:bg-green-900/30',
    accentColor: 'text-green-600 dark:text-green-400',
    barColor: 'bg-green-300 dark:bg-green-700',
    buttonClass: 'text-green-600 bg-green-100/50 hover:bg-green-100 dark:text-green-300 dark:bg-green-900/30 dark:hover:bg-green-900/50'
  }
];

function getCardsForColumn(columnId: string) {
  return kanbanStore.cards
    .filter(card => card.status === columnId)
    .sort((a, b) => a.card_order - b.card_order);
}

function setColumnRef(el: any, id: string) {
  if (el) {
    columnRefs.value.set(id, el as HTMLElement);
  }
}

// Drag and Drop
function initKanbanSortables() {
  columns.forEach(col => {
    const el = columnRefs.value.get(col.id);
    if (el) {
      new Sortable(el, {
        group: 'kanban',
        animation: 200,
        delay: 100,
        delayOnTouchOnly: true,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        forceFallback: true, // Smooth drag on all devices
        onEnd: async (evt) => {
          const { item, to, newIndex } = evt;
          const cardId = parseInt(item.dataset.cardId as string);
          const newStatus = to.dataset.columnId;
          
          if (cardId && newStatus !== undefined) {
            await kanbanStore.reorderKanbanCard(cardId, newStatus, newIndex);
          }
        }
      });
    }
  });
}

// Watchers
watch(() => [kanbanStore.cards.length, isMounted.value], () => {
  if (isMounted.value) {
    nextTick(initKanbanSortables);
  }
});

onMounted(async () => {
  isMounted.value = true;
  await kanbanStore.fetchKanbanCards();
  nextTick(initKanbanSortables);
});

// Handlers
function openAddNoteModal(status: string) {
  cardToEdit.value = null;
  newNoteStatus.value = status;
  showAddNoteModal.value = true;
}

function openEditNoteModal(card: KanbanCard) {
  cardToEdit.value = { ...card };
  showAddNoteModal.value = true;
}

async function handleSaveNote(card: CreateKanbanCardDto) {
  try {
    await kanbanStore.createKanbanCard(card);
    toast.success('Card added');
    showAddNoteModal.value = false;
  } catch (e) {
    toast.error('Failed to add card');
  }
}

async function handleUpdateNote(card: KanbanCard) {
  try {
    await kanbanStore.updateKanbanCard(card.id, card);
    toast.success('Card updated');
    showAddNoteModal.value = false;
  } catch (e) {
    toast.error('Failed to update card');
  }
}

function openDeleteCardModal(cardId: number) {
  cardToDelete.value = cardId;
  showDeleteCardModal.value = true;
}

async function confirmDeleteCard() {
  if (cardToDelete.value === null) return;
  try {
    await kanbanStore.deleteKanbanCard(cardToDelete.value);
    toast.success('Card deleted!');
  } catch (error) {
    toast.error('Failed to delete card');
  } finally {
    showDeleteCardModal.value = false;
    cardToDelete.value = null;
  }
}

async function confirmClearCompleted() {
  try {
    await kanbanStore.deleteCompletedCards();
    toast.success('Cleared completed cards');
  } catch (error) {
     toast.error('Failed to clear completed cards');
  } finally {
    showDeleteCompletedModal.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-white dark:bg-gray-900 font-sans">
    
    <!-- Top Header -->
    <div class="h-14 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 z-10">
      <div class="flex items-center gap-2">
        <div class="p-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <UIcon name="i-heroicons-view-columns" class="w-5 h-5" />
        </div>
        <span class="font-semibold text-gray-900 dark:text-white text-base">Kanban Board</span>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink
          to="/settings"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          title="Settings"
        >
          <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5" />
        </NuxtLink>
      </div>
    </div>

    <!-- Kanban Board (Main Area) -->
    <main class="flex-1 flex overflow-x-auto overflow-y-hidden p-6 bg-white dark:bg-gray-900">
      <div class="h-full flex gap-6 min-w-max mx-auto">
        <div 
          v-for="col in columns" 
          :key="col.id" 
          class="w-80 flex flex-col h-full rounded-2xl transition-colors duration-300 border border-transparent"
          :class="[col.bgClass, 'border-opacity-50 hover:border-gray-200 dark:hover:border-gray-700']"
        >
          <!-- Column Header -->
          <div 
            class="p-4 flex flex-col gap-3 flex-shrink-0 rounded-t-2xl"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-lg bg-white/60 dark:bg-gray-800/40 shadow-sm backdrop-blur-sm" :class="col.accentColor">
                  <UIcon :name="col.headerIcon" class="w-4 h-4" />
                </div>
                <h3 class="font-semibold text-gray-900 dark:text-white text-base tracking-tight">{{ col.title }}</h3>
                <span 
                  class="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/50 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700/50"
                >
                  {{ getCardsForColumn(col.id).length }}
                </span>
              </div>
              
              <button 
                v-if="col.id === 'completed' && getCardsForColumn(col.id).length > 0" 
                @click="showDeleteCompletedModal = true" 
                class="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                title="Clear Completed"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
            </div>
            
            <!-- Progress Bar Decoration -->
            <div class="h-1 w-full rounded-full bg-gray-200/50 dark:bg-gray-700/50 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500 ease-out w-full opacity-70" :class="col.barColor"></div>
            </div>
          </div>

          <!-- Cards List -->
          <div 
            :ref="(el) => setColumnRef(el, col.id)"
            :data-column-id="col.id"
            class="flex-1 overflow-y-auto px-3 pb-3 space-y-3 custom-scrollbar"
          >
            <div 
              v-for="card in getCardsForColumn(col.id)" 
              :key="card.id" 
              :data-card-id="card.id"
              class="group relative bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:border-blue-300/50 dark:hover:border-blue-500/30 transition-all duration-200 cursor-grab active:cursor-grabbing hover:scale-[1.02]"
              @click="openEditNoteModal(card)"
            >
              <div class="flex justify-between items-start gap-3 mb-2">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">{{ card.title }}</h4>
                <button 
                  class="flex-shrink-0 p-1 -mr-1 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                </button>
              </div>
              
              <div 
                v-if="card.content" 
                class="prose prose-xs dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 line-clamp-3 mb-3 text-xs" 
                v-html="card.content"
              ></div>
              
              <div class="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50">
                <span class="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  #{{ card.id }}
                </span>
                
                <button 
                  class="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all" 
                  @click.stop="openDeleteCardModal(card.id)"
                >
                  <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Add Card Button (Footer) -->
          <div class="p-3 pt-0 mt-auto">
            <button 
              @click="openAddNoteModal(col.id)" 
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm group"
              :class="col.buttonClass"
            >
              <div class="p-0.5 rounded-full bg-white/50 dark:bg-black/20 group-hover:scale-110 transition-transform">
                <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
              </div>
              <span>Add Task</span>
            </button>
          </div>
        </div>
      </div>
    </main>

    <AddNoteModal 
      v-model="showAddNoteModal"
      :status="newNoteStatus"
      :card="cardToEdit"
      @save="handleSaveNote"
      @update="handleUpdateNote"
    />

    <!-- Delete Card Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-200" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="showDeleteCardModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="showDeleteCardModal = false">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 dark:border-gray-700 transform transition-all scale-100">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                  <UIcon name="i-heroicons-trash" class="w-6 h-6" />
                </div>
                <h3 class="text-lg font-bold dark:text-white">Delete Card?</h3>
              </div>
              <p class="text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed">Are you sure you want to delete this card? This action cannot be undone.</p>
              <div class="flex justify-end gap-3">
                <button @click="showDeleteCardModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
                <button @click="confirmDeleteCard" class="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md shadow-red-500/20 transition-all">Delete</button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

     <!-- Delete Completed Cards Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-200" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="showDeleteCompletedModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="showDeleteCompletedModal = false">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 dark:border-gray-700">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                  <UIcon name="i-heroicons-archive-box-x-mark" class="w-6 h-6" />
                </div>
                <h3 class="text-lg font-bold dark:text-white">Clear Completed?</h3>
              </div>
              <p class="text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed">Are you sure you want to delete all cards in the "Completed" column? This cannot be undone.</p>
              <div class="flex justify-end gap-3">
                <button @click="showDeleteCompletedModal = false" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
                <button @click="confirmClearCompleted" class="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md shadow-red-500/20 transition-all">Clear All</button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Drag & Drop Visuals */
.sortable-ghost {
  opacity: 0.4;
  background-color: #f3f4f6; /* gray-100 */
  border: 2px dashed #d1d5db; /* gray-300 */
}
.dark .sortable-ghost {
  background-color: #374151; /* gray-700 */
  border-color: #4b5563; /* gray-600 */
}

.sortable-drag {
  cursor: grabbing;
  opacity: 1;
  background: white;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: scale(1.02);
}
.dark .sortable-drag {
  background: #1f2937; /* gray-800 */
}
</style>