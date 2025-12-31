<script setup lang="ts">
import type { HistoryLogWithEntity, EntityType, ActionType, ContributingUser } from '~/models/HistoryLog';

const authStore = useAuthStore();
const toast = useToast();

// State
const logs = ref<HistoryLogWithEntity[]>([]);
const loading = ref(false);
const total = ref(0);
const hasMore = ref(false);
const offset = ref(0);
const limit = 20;

// Filters
const selectedEntityType = ref<EntityType | undefined>(undefined);
const selectedAction = ref<ActionType | undefined>(undefined);
const selectedUserId = ref<number | undefined>(undefined);

// Contributing users for filter
const contributingUsers = ref<ContributingUser[]>([]);

// Expanded log entries for viewing diffs
const expandedLogs = ref<Set<number>>(new Set());

// Entity type options
const entityTypeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Pages', value: 'page' },
  { label: 'Notebooks', value: 'notebook' },
  { label: 'Sections', value: 'section' }
];

// Action type options
const actionOptions = [
  { label: 'All Actions', value: '' },
  { label: 'Created', value: 'create' },
  { label: 'Updated', value: 'update' },
  { label: 'Deleted', value: 'delete' }
];

// User options (computed)
const userOptions = computed(() => {
  const options = [{ label: 'All Users', value: '' }];
  contributingUsers.value.forEach(u => {
    options.push({ label: `${u.user_name} (${u.change_count})`, value: String(u.user_id) });
  });
  return options;
});

async function loadLogs(reset = false) {
  if (reset) offset.value = 0;
  loading.value = true;

  try {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', offset.value.toString());

    if (selectedEntityType.value) params.set('entity_type', selectedEntityType.value);
    if (selectedUserId.value) params.set('user_id', selectedUserId.value.toString());
    if (selectedAction.value) params.set('action', selectedAction.value);

    const response = await $fetch<{ logs: HistoryLogWithEntity[]; total: number; hasMore: boolean }>(
      `/api/history?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` }
      }
    );

    if (reset) {
      logs.value = response.logs;
    } else {
      logs.value.push(...response.logs);
    }
    total.value = response.total;
    hasMore.value = response.hasMore;
  } catch (error) {
    toast.add({
      title: 'Error',
      description: 'Failed to load history',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

async function loadContributingUsers() {
  try {
    contributingUsers.value = await $fetch('/api/history/users', {
      headers: { Authorization: `Bearer ${authStore.token}` }
    });
  } catch (error) {
    console.error('Failed to load contributing users:', error);
  }
}

function loadMore() {
  offset.value += limit;
  loadLogs(false);
}

function toggleExpand(logId: number) {
  if (expandedLogs.value.has(logId)) {
    expandedLogs.value.delete(logId);
  } else {
    expandedLogs.value.add(logId);
  }
}

// Watch filters and reload
watch([selectedEntityType, selectedAction, selectedUserId], () => loadLogs(true));

onMounted(() => {
  loadLogs(true);
  loadContributingUsers();
});

// Utility functions
function getActionColor(action: ActionType) {
  switch (action) {
    case 'create': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    case 'update': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    case 'delete': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
  }
}

function getActionIcon(action: ActionType) {
  switch (action) {
    case 'create': return 'i-heroicons-plus-circle';
    case 'update': return 'i-heroicons-pencil-square';
    case 'delete': return 'i-heroicons-trash';
  }
}

function getEntityIcon(type: EntityType) {
  switch (type) {
    case 'page': return 'i-heroicons-document-text';
    case 'notebook': return 'i-heroicons-book-open';
    case 'section': return 'i-heroicons-folder';
  }
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString();
}

function parseValue(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getActionVerb(action: ActionType) {
  switch (action) {
    case 'create': return 'created';
    case 'update': return 'updated';
    case 'delete': return 'deleted';
  }
}

function getEntityLabel(type: EntityType) {
  switch (type) {
    case 'page': return 'Page';
    case 'notebook': return 'Notebook';
    case 'section': return 'Section';
  }
}
</script>

<template>
  <div class="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Activity History</h2>
          <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Track all changes to your notes, notebooks, and sections
          </p>
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ total }} total changes
        </span>
      </div>
    </div>

    <!-- Filters -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div class="flex flex-wrap gap-3">
        <!-- Entity Type Filter -->
        <select
          v-model="selectedEntityType"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="opt in entityTypeOptions" :key="opt.value" :value="opt.value || undefined">
            {{ opt.label }}
          </option>
        </select>

        <!-- Action Filter -->
        <select
          v-model="selectedAction"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value || undefined">
            {{ opt.label }}
          </option>
        </select>

        <!-- User Filter (only show if multiple users) -->
        <select
          v-if="contributingUsers.length > 1"
          v-model="selectedUserId"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="opt in userOptions" :key="opt.value" :value="opt.value ? Number(opt.value) : undefined">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Log List -->
    <div class="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
      <div v-if="loading && logs.length === 0" class="p-8 text-center text-gray-500">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto mb-2" />
        Loading history...
      </div>

      <div v-else-if="logs.length === 0" class="p-8 text-center text-gray-500">
        <UIcon name="i-heroicons-clock" class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p>No history found</p>
        <p class="text-xs mt-1">Changes will appear here after you create, edit, or delete content</p>
      </div>

      <div
        v-for="log in logs"
        :key="log.id"
        class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <!-- Log Header -->
        <button
          @click="toggleExpand(log.id)"
          class="w-full px-4 py-3 text-left"
        >
          <div class="flex items-start gap-3">
            <!-- Action Icon -->
            <div :class="[getActionColor(log.action), 'p-1.5 rounded flex-shrink-0']">
              <UIcon :name="getActionIcon(log.action)" class="w-4 h-4" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium text-sm text-gray-900 dark:text-white">
                  {{ log.user_name }}
                </span>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ getActionVerb(log.action) }}
                </span>
                <span class="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                  <UIcon :name="getEntityIcon(log.entity_type)" class="w-4 h-4" />
                  <span class="truncate max-w-[200px]">{{ log.entity_title || `${getEntityLabel(log.entity_type)} ${log.entity_id.slice(0, 8)}...` }}</span>
                </span>
                <span v-if="log.field_name" class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  {{ formatFieldName(log.field_name) }}
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ formatDate(log.created_at) }}
              </p>
            </div>

            <!-- Expand Icon -->
            <UIcon
              :name="expandedLogs.has(log.id) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="w-5 h-5 text-gray-400 flex-shrink-0"
            />
          </div>
        </button>

        <!-- Expanded Diff View -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-[500px]"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 max-h-[500px]"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="expandedLogs.has(log.id)" class="overflow-hidden">
            <SettingsDiffViewer
              :old-value="parseValue(log.old_value)"
              :new-value="parseValue(log.new_value)"
              :field-name="log.field_name"
              :action="log.action"
            />
          </div>
        </Transition>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="hasMore" class="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="loadMore"
        :disabled="loading"
        class="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded disabled:opacity-50"
      >
        <span v-if="loading" class="inline-flex items-center gap-2">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          Loading...
        </span>
        <span v-else>Load More</span>
      </button>
    </div>
  </div>
</template>
