<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { CreateKanbanCardDto, KanbanCard } from '~/models/Kanban';

const props = defineProps<{
  modelValue: boolean;
  status: string;
  card?: KanbanCard | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', card: CreateKanbanCardDto): void;
  (e: 'update', card: KanbanCard): void;
}>();

const title = ref('');
const content = ref('');
const loading = ref(false);
const isPolishing = ref(false);
const isAskingAI = ref(false);

const isEditing = computed(() => !!props.card);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (isEditing.value && props.card) {
      title.value = props.card.title;
      content.value = props.card.content || '';
    } else {
      title.value = '';
      content.value = '';
    }
  }
});

async function save() {
  if (!title.value.trim()) return;

  loading.value = true;
  try {
    if (isEditing.value && props.card) {
      emit('update', {
        ...props.card,
        title: title.value,
        content: content.value,
      });
    } else {
      emit('save', {
        title: title.value,
        content: content.value,
        status: props.status
      });
    }
  } finally {
    loading.value = false;
  }
}

async function polishNote() {
  if (!title.value.trim() && !content.value.trim()) {
    return;
  }

  isPolishing.value = true;
  try {
    const response = await $fetch<{ title: string; content: string }>('/api/notes/polish', {
      method: 'POST',
      body: {
        title: title.value,
        content: content.value,
      },
    });
    title.value = response.title;
    content.value = response.content;
  } catch (error) {
    console.error('Failed to polish note:', error);
  } finally {
    isPolishing.value = false;
  }
}

async function askAINote(prompt: string) {
  if (!prompt.trim()) {
    return;
  }

  isAskingAI.value = true;
  try {
    const response = await $fetch<{ content: string }>('/api/notes/ask-ai', {
      method: 'POST',
      body: {
        title: title.value,
        content: content.value,
        prompt,
      },
    });
    content.value = response.content;
  } catch (error) {
    console.error('Failed to ask AI:', error);
  } finally {
    isAskingAI.value = false;
  }
}


function closeModal() {
  emit('update:modelValue', false);
}
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="modelValue" 
          class="fixed inset-0 z-[60] overflow-y-auto"
          @click.self="closeModal"
        >
          <!-- Backdrop -->
          <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
          
          <!-- Modal -->
          <div class="flex min-h-[fit-content] items-center justify-center p-4">
            <Transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95 translate-y-4"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 translate-y-4"
            >
              <div 
                v-if="modelValue"
                class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-2xl w-full p-5 max-h-[80vh] flex flex-col"
                @click.stop
              >
                <!-- Header -->
                <div class="flex items-center justify-between mb-4 flex-shrink-0">
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ isEditing ? 'Edit Card' : 'Add New Card' }}
                  </h3>
                  <button
                    type="button"
                    @click="closeModal"
                    class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                  </button>
                </div>
                
                <!-- Content -->
                <div class="space-y-4 overflow-y-auto flex-grow">
                  <div>
                    <label class="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                      Title
                    </label>
                    <input
                      v-model="title"
                      type="text"
                      placeholder="Card title"
                      autofocus
                      class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div class="flex flex-col flex-grow">
                    <label class="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                      Content
                    </label>
                    <div class="flex-grow overflow-hidden">
                      <UnifiedEditor
                        v-model="content"
                        :editable="!isPolishing && !isAskingAI"
                        :hide-ai-buttons="true"
                        class="h-full"
                      />
                    </div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-wrap items-center justify-end gap-2 pt-4 flex-shrink-0">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      @click="closeModal"
                      :disabled="loading"
                      class="px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      @click="save"
                      :disabled="loading"
                      class="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <UIcon 
                        v-if="loading" 
                        name="i-heroicons-arrow-path" 
                        class="w-4 h-4 animate-spin" 
                      />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
