<script setup lang="ts">
const toast = useToast();
const authStore = useAuthStore();

interface ApiKey {
  id: number;
  key_name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  is_active: boolean;
}

const keys = ref<ApiKey[]>([]);
const loading = ref(false);
const creating = ref(false);
const deleting = ref<number | null>(null);
const showDeleteConfirm = ref(false);
const keyToDelete = ref<ApiKey | null>(null);

// New key state
const newKeyName = ref('');
const showNewKeyModal = ref(false);
const generatedKey = ref('');

async function fetchKeys() {
  loading.value = true;
  try {
    const data = await $fetch<{ keys: ApiKey[] }>('/api/user/api-keys', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    keys.value = data.keys;
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: 'Failed to load API keys',
      color: 'red'
    });
  } finally {
    loading.value = false;
  }
}

async function createKey() {
  if (!newKeyName.value.trim()) return;

  creating.value = true;
  try {
    const data = await $fetch<ApiKey & { key: string }>('/api/user/api-keys', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        key_name: newKeyName.value
      }
    });

    generatedKey.value = data.key;
    showNewKeyModal.value = true;
    newKeyName.value = '';
    await fetchKeys();
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to create API key',
      color: 'red'
    });
  } finally {
    creating.value = false;
  }
}

function deleteKey(key: ApiKey) {
  keyToDelete.value = key;
  showDeleteConfirm.value = true;
}

async function confirmDeleteKey() {
  if (!keyToDelete.value) return;

  const id = keyToDelete.value.id;
  deleting.value = id;
  try {
    await $fetch(`/api/user/api-keys/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    
    toast.add({
      title: 'Success',
      description: 'API key revoked',
      color: 'green'
    });
    showDeleteConfirm.value = false;
    keyToDelete.value = null;
    await fetchKeys();
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: 'Failed to revoke API key',
      color: 'red'
    });
  } finally {
    deleting.value = null;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.add({
    title: 'Copied',
    description: 'API key copied to clipboard',
    color: 'green'
  });
}

onMounted(() => {
  fetchKeys();
});
</script>

<template>
  <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">Developer Settings</h2>
      <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
        Manage API keys for programmatic access
      </p>
    </div>
    
    <div class="p-4 space-y-6">
      <!-- Create New Key -->
      <div class="flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
            New API Key Name
          </label>
          <UInput
            v-model="newKeyName"
            placeholder="e.g. My Integration"
            size="md"
            :disabled="creating"
            class="w-full"
            :ui="{ rounded: 'rounded-none' }"
            @keyup.enter="createKey"
          />
        </div>
        <button
          @click="createKey"
          :disabled="!newKeyName.trim() || creating"
          class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 h-[42px]"
        >
          <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          <UIcon v-else name="i-heroicons-plus" class="w-4 h-4" />
          <span>Generate Key</span>
        </button>
      </div>

      <!-- Keys List -->
      <div v-if="loading && keys.length === 0" class="text-center py-4 text-gray-500">
        Loading API keys...
      </div>
      
      <div v-else-if="keys.length === 0" class="text-center py-4 text-gray-500 text-sm italic border border-dashed border-gray-300 dark:border-gray-700 p-4">
        No API keys found. Generate one to get started.
      </div>

      <div v-else class="space-y-3">
        <div v-for="key in keys" :key="key.id" class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium text-sm text-gray-900 dark:text-white">{{ key.key_name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono">
                {{ key.key_prefix }}...
              </span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Created: {{ new Date(key.created_at).toLocaleDateString() }}
              <span v-if="key.last_used_at"> • Last used: {{ new Date(key.last_used_at).toLocaleDateString() }}</span>
            </div>
          </div>
          
          <button
            @click="deleteKey(key)"
            :disabled="deleting === key.id"
            class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Revoke Key"
          >
            <UIcon v-if="deleting === key.id" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
            <UIcon v-else name="i-heroicons-trash" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
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
            v-if="showDeleteConfirm" 
            class="fixed inset-0 z-[60] overflow-y-auto"
            @click.self="showDeleteConfirm = false"
          >
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/60 transition-opacity"></div>
            
            <!-- Modal -->
            <div class="flex min-h-full items-center justify-center p-4">
              <Transition
                enter-active-class="transition-all duration-200"
                enter-from-class="opacity-0 scale-95 translate-y-4"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition-all duration-200"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 translate-y-4"
              >
                <div 
                  class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-sm w-full p-5"
                  @click.stop
                >
                  <!-- Header -->
                  <div class="flex items-center gap-3 mb-3">
                    <div class="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 flex items-center justify-center rounded">
                      <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div class="flex-1">
                      <h3 class="text-base font-bold text-gray-900 dark:text-white">
                        Revoke API Key
                      </h3>
                    </div>
                    <button
                      type="button"
                      @click="showDeleteConfirm = false"
                      class="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                      :disabled="!!deleting"
                    >
                      <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                    </button>
                  </div>

                  <!-- Content -->
                  <div class="mb-5">
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Are you sure you want to revoke the API key <strong class="text-gray-900 dark:text-white">"{{ keyToDelete?.key_name }}"</strong>? 
                    </p>
                    <p class="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                      This action cannot be undone and any applications using this key will lose access immediately.
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      @click="showDeleteConfirm = false"
                      :disabled="!!deleting"
                      class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      @click="confirmDeleteKey"
                      :disabled="!!deleting"
                      class="flex-1 px-3 py-2 bg-red-600 dark:bg-red-500 text-white text-sm font-normal border border-red-700 dark:border-red-600 hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <UIcon
                        v-if="!!deleting"
                        name="i-heroicons-arrow-path"
                        class="w-4 h-4 animate-spin"
                      />
                      <UIcon
                        v-else
                        name="i-heroicons-trash"
                        class="w-4 h-4"
                      />
                      <span>Revoke</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- New Key Modal -->
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
            v-if="showNewKeyModal" 
            class="fixed inset-0 z-[60] overflow-y-auto"
            @click.self="showNewKeyModal = false"
          >
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
            
            <!-- Modal -->
            <div class="flex min-h-full items-center justify-center p-4">
              <Transition
                enter-active-class="transition-all duration-200"
                enter-from-class="opacity-0 scale-95 translate-y-4"
                enter-to-class="opacity-100 scale-100 translate-y-0"
                leave-active-class="transition-all duration-200"
                leave-from-class="opacity-100 scale-100 translate-y-0"
                leave-to-class="opacity-0 scale-95 translate-y-4"
              >
                <div 
                  class="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-lg max-w-md w-full p-6"
                  @click.stop
                >
                  <div class="flex items-center gap-3 mb-4 text-green-600 dark:text-green-400">
                    <UIcon name="i-heroicons-check-circle" class="w-6 h-6" />
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">API Key Generated</h3>
                  </div>
                  
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Please copy your new API key now. <span class="font-bold text-red-600 dark:text-red-400">You won't be able to see it again!</span>
                  </p>

                  <div class="relative mb-6">
                    <div class="w-full p-3 pr-10 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded font-mono text-sm break-all text-gray-800 dark:text-gray-200">
                      {{ generatedKey }}
                    </div>
                    <button
                      @click="copyToClipboard(generatedKey)"
                      class="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Copy to clipboard"
                    >
                      <UIcon name="i-heroicons-clipboard-document" class="w-5 h-5" />
                    </button>
                  </div>

                  <div class="flex justify-end">
                    <button
                      @click="showNewKeyModal = false"
                      class="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium rounded hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </Teleport>
    </ClientOnly>
  </div>
</template>
