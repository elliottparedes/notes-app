<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useKanbanStore } from '~/stores/kanban';
import { useToast } from '~/composables/useToast';
import type { KanbanCard, CreateKanbanCardDto } from '~/models/Kanban';
import Sortable from 'sortablejs';

const router = useRouter();
const authStore = useAuthStore();
const kanbanStore = useKanbanStore();
const toast = useToast();

const isMounted = ref(false);
const showViewDropdown = ref(false);

const columnRefs = ref(new Map<string, HTMLElement>());
const quickAddContent = ref<Record<string, string>>({});

// Delete card confirmation
const showDeleteCardModal = ref(false);
const cardToDelete = ref<number | null>(null);

// Delete completed confirmation
const showDeleteCompletedModal = ref(false);

const columns = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'in_review', title: 'In Review', color: 'bg-yellow-500' },
  { id: 'completed', title: 'Completed', color: 'bg-green-500' }
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
        animation: 150,
        delay: 100,
        delayOnTouchOnly: true,
        ghostClass: 'opacity-50',
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
async function handleQuickAdd(columnId: string) {
  const title = quickAddContent.value[columnId]?.trim();
  if (!title) return;
  
  try {
    await kanbanStore.createKanbanCard({
      title: title,
      status: columnId,
    } as CreateKanbanCardDto);
    quickAddContent.value[columnId] = '';
    toast.success('Card added');
  } catch (e) {
    toast.error('Failed to add card');
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
  <div class="flex flex-col h-screen w-full bg-white dark:bg-gray-900">
    
    <!-- Top Header -->
    <div class="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <div class="flex items-center gap-2 relative">
        <div class="relative" data-view-dropdown>
          <button
            @click.stop="showViewDropdown = !showViewDropdown"
            class="flex items-center gap-1.5 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-md transition-colors"
          >
            <UIcon name="i-heroicons-view-columns" class="w-4 h-4 text-gray-500" />
            <span>Kanban</span>
            <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': showViewDropdown }" />
          </button>
          
          <Transition
            enter-active-class="transition-opacity duration-100"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="showViewDropdown" class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-xl py-1 z-50 rounded-lg" @click.stop>
              <button @click="router.push('/notes'); showViewDropdown = false" class="w-full text-left px-3 py-2 text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                <UIcon name="i-heroicons-book-open" class="w-4 h-4" />
                <span>Notebooks</span>
              </button>
              <button @click="showViewDropdown = false" class="w-full text-left px-3 py-2 text-sm transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2">
                <UIcon name="i-heroicons-view-columns" class="w-4 h-4" />
                <span>Kanban</span>
              </button>
              <button @click="router.push('/storage'); showViewDropdown = false" class="w-full text-left px-3 py-2 text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                <UIcon name="i-heroicons-folder" class="w-4 h-4" />
                <span>Storage</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Kanban Board (Main Area) -->
    <main class="flex-1 flex overflow-x-auto overflow-y-hidden p-4">
      <div class="h-full flex gap-4 justify-center w-full">
        <div 
          v-for="col in columns" 
          :key="col.id" 
          class="w-72 flex flex-col h-full rounded-lg bg-gray-50 dark:bg-gray-800/50"
        >
          <!-- Column Header -->
          <div class="p-3 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :class="col.color"></span>
              <h3 class="font-semibold text-gray-700 dark:text-gray-200 text-sm">{{ col.title }}</h3>
              <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {{ getCardsForColumn(col.id).length }}
              </span>
            </div>
             <button v-if="col.id === 'completed' && getCardsForColumn(col.id).length > 0" @click="showDeleteCompletedModal = true" class="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400">Clear All</button>
          </div>

          <!-- Cards List -->
          <div 
            :ref="(el) => setColumnRef(el, col.id)"
            :data-column-id="col.id"
            class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar"
          >
            <div 
              v-for="card in getCardsForColumn(col.id)" 
              :key="card.id" 
              :data-card-id="card.id"
              class="group bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing"
            >
              <p class="text-sm text-gray-900 dark:text-white">{{ card.title }}</p>
              <div class="flex items-center justify-end mt-2">
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400" @click.stop="openDeleteCardModal(card.id)">
                    <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Add -->
          <div class="p-2 flex-shrink-0">
            <input 
              v-model="quickAddContent[col.id]"
              type="text" 
              placeholder="+ Add a card"
              class="w-full px-2 py-1.5 text-sm bg-transparent border-none rounded-md placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              @keydown.enter="handleQuickAdd(col.id)"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- Delete Card Confirmation Modal -->
    <ClientOnly>
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-200" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="showDeleteCardModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showDeleteCardModal = false">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full">
              <h3 class="text-lg font-bold mb-2 dark:text-white">Delete Card?</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-4">Are you sure? This action cannot be undone.</p>
              <div class="flex justify-end gap-2">
                <button @click="showDeleteCardModal = false" class="px-4 py-2 text-gray-600 dark:text-gray-300">Cancel</button>
                <button @click="confirmDeleteCard" class="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
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
          <div v-if="showDeleteCompletedModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showDeleteCompletedModal = false">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full">
              <h3 class="text-lg font-bold mb-2 dark:text-white">Clear Completed Cards?</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-4">Are you sure you want to delete all cards in the "Completed" column? This cannot be undone.</p>
              <div class="flex justify-end gap-2">
                <button @click="showDeleteCompletedModal = false" class="px-4 py-2 text-gray-600 dark:text-gray-300">Cancel</button>
                <button @click="confirmClearCompleted" class="px-4 py-2 bg-red-600 text-white rounded-lg">Clear All</button>
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
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}
</style>