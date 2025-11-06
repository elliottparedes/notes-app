<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const isLoading = ref(true);
const stats = ref<any>(null);

interface AnalyticsStats {
  total_notes: number;
  total_words: number;
  notes_this_week: number;
  notes_this_month: number;
  most_used_tags: Array<{ tag: string; count: number }>;
  notes_by_day: Array<{ date: string; count: number }>;
  copilot_usage: number;
}

async function loadStats() {
  try {
    isLoading.value = true;
    const data = await $fetch<AnalyticsStats>(`/api/analytics/stats?period=30`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });
    stats.value = data;
  } catch (error) {
    console.error('Failed to load analytics:', error);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin"></div>
    </div>

    <!-- Stats Grid -->
    <div v-else-if="stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Notes -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center mb-3">
            <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Notes</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ stats.total_notes }}</p>
        </div>
      </div>

      <!-- Total Words -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center mb-3">
            <UIcon name="i-heroicons-pencil-square" class="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Words Written</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ stats.total_words.toLocaleString() }}
          </p>
        </div>
      </div>

      <!-- Notes This Week -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3">
            <UIcon name="i-heroicons-calendar-days" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Notes This Week</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ stats.notes_this_week }}</p>
        </div>
      </div>

      <!-- Notes This Month -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-3">
            <UIcon name="i-heroicons-chart-bar" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Notes This Month</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ stats.notes_this_month }}</p>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div v-else-if="stats" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Notes by Day -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes Created</h3>
        <div class="space-y-2">
          <div
            v-for="(day, index) in stats.notes_by_day.slice(0, 7).reverse()"
            :key="day.date"
            class="flex items-center gap-3"
          >
            <div class="text-xs text-gray-500 dark:text-gray-400 w-20">
              {{ new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
            </div>
            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
              <div
                class="bg-primary-600 dark:bg-primary-400 h-full rounded-full transition-all duration-500"
                :style="{ width: `${(day.count / Math.max(...stats.notes_by_day.map(d => d.count), 1)) * 100}%` }"
              />
              <span class="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ day.count }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Tags -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Most Used Tags</h3>
        <div class="space-y-2">
          <div
            v-for="tagStat in stats.most_used_tags.slice(0, 8)"
            :key="tagStat.tag"
            class="flex items-center gap-3"
          >
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 truncate">
              {{ tagStat.tag }}
            </span>
            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
              <div
                class="bg-teal-600 dark:bg-teal-400 h-full rounded-full transition-all duration-500"
                :style="{ width: `${(tagStat.count / Math.max(...stats.most_used_tags.map(t => t.count), 1)) * 100}%` }"
              />
              <span class="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ tagStat.count }}
              </span>
            </div>
          </div>
          <p v-if="stats.most_used_tags.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No tags yet
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

