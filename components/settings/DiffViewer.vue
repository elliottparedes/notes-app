<script setup lang="ts">
import { diffLines, diffWords } from 'diff';
import type { ActionType } from '~/models/HistoryLog';

const props = defineProps<{
  oldValue: unknown;
  newValue: unknown;
  fieldName: string | null;
  action: ActionType;
}>();

// Determine if this is a content/text field that needs line-by-line diff
const isContentField = computed(() =>
  props.fieldName === 'content' ||
  (!props.fieldName && typeof props.oldValue === 'string' && (props.oldValue as string).length > 100)
);

// Format value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return JSON.stringify(value, null, 2);
}

// Generate diff for text content
const textDiff = computed(() => {
  const oldStr = formatValue(props.oldValue);
  const newStr = formatValue(props.newValue);

  if (isContentField.value) {
    return diffLines(oldStr, newStr);
  } else {
    return diffWords(oldStr, newStr);
  }
});

// For create/delete actions, show the entire value
const showSingleValue = computed(() =>
  props.action === 'create' || props.action === 'delete'
);
</script>

<template>
  <div class="mx-4 mb-4 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-400">
      <span v-if="action === 'create'">Created with:</span>
      <span v-else-if="action === 'delete'">Deleted:</span>
      <span v-else>Changes:</span>
    </div>

    <!-- Content -->
    <div class="bg-gray-50 dark:bg-gray-800">
      <!-- Create/Delete: Show full value -->
      <template v-if="showSingleValue">
        <pre
          class="p-3 text-sm font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto"
          :class="action === 'create' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'"
        >{{ formatValue(action === 'create' ? newValue : oldValue) || '(empty)' }}</pre>
      </template>

      <!-- Update: Show diff -->
      <template v-else>
        <!-- Line-by-line diff for content -->
        <div v-if="isContentField" class="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
          <div
            v-for="(part, index) in textDiff"
            :key="index"
            class="flex"
          >
            <div
              class="w-8 flex-shrink-0 text-center py-1 text-xs font-mono select-none"
              :class="part.added ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300' :
                      part.removed ? 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-400'"
            >
              {{ part.added ? '+' : part.removed ? '-' : ' ' }}
            </div>
            <pre
              class="flex-1 px-3 py-1 text-sm font-mono whitespace-pre-wrap break-words"
              :class="part.added ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' :
                      part.removed ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200' :
                      'text-gray-700 dark:text-gray-300'"
            >{{ part.value }}</pre>
          </div>
        </div>

        <!-- Inline diff for short values -->
        <div v-else class="p-3">
          <div class="flex items-start gap-4">
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Before</div>
              <div class="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-800 dark:text-red-200 font-mono break-words">
                {{ formatValue(oldValue) || '(empty)' }}
              </div>
            </div>
            <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 text-gray-400 mt-6 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">After</div>
              <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-800 dark:text-green-200 font-mono break-words">
                {{ formatValue(newValue) || '(empty)' }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
