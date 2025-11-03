<script setup lang="ts">
import type { PublishedNoteWithDetails } from '~/models';

const route = useRoute();
const shareId = computed(() => route.params.shareId as string);
const publishedNote = ref<PublishedNoteWithDetails | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

// Client-side checks
const isClient = ref(false);
const hasShareAPI = ref(false);

onMounted(async () => {
  isClient.value = true;
  hasShareAPI.value = typeof navigator !== 'undefined' && 'share' in navigator;
  
  try {
    const data = await $fetch<PublishedNoteWithDetails>(`/api/publish/note/${shareId.value}`);
    publishedNote.value = data;
  } catch (err: any) {
    error.value = err.data?.message || 'Failed to load published note';
    console.error('Error loading published note:', err);
  } finally {
    isLoading.value = false;
  }
});

// Copy link function
function copyLink() {
  if (isClient.value && navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href);
    // You could show a toast here if you want
  }
}

// Share function
async function shareLink() {
  if (isClient.value && navigator.share) {
    try {
      await navigator.share({ url: window.location.href });
    } catch (err) {
      // User cancelled or error occurred
      console.error('Error sharing:', err);
    }
  }
}

// Use head composable for SEO
useHead({
  title: computed(() => publishedNote.value?.note_title || 'Published Note'),
  meta: [
    {
      name: 'description',
      content: computed(() => publishedNote.value?.note_content?.substring(0, 160) || 'Published note')
    }
  ]
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <!-- Header -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ publishedNote?.note_title || 'Published Note' }}
              </h1>
              <p v-if="publishedNote?.owner_name" class="text-sm text-gray-500 dark:text-gray-400">
                Published by {{ publishedNote.owner_name }}
              </p>
            </div>
          </div>
          <UButton
            v-if="hasShareAPI"
            icon="i-heroicons-share"
            color="primary"
            variant="soft"
            size="sm"
            @click="shareLink"
          >
            Share
          </UButton>
          <UButton
            v-else
            icon="i-heroicons-clipboard-document"
            color="primary"
            variant="soft"
            size="sm"
            @click="copyLink"
          >
            Copy Link
          </UButton>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="max-w-4xl mx-auto px-4 py-12">
      <div class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="max-w-4xl mx-auto px-4 py-12">
      <div class="text-center">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Note Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>
    </div>

    <!-- Note Content -->
    <main v-else-if="publishedNote" class="max-w-4xl mx-auto px-4 py-8">
      <article class="prose prose-lg dark:prose-invert max-w-none">
        <div v-if="publishedNote.note_content" class="note-content" v-html="publishedNote.note_content"></div>
        <div v-else class="text-gray-500 dark:text-gray-400 italic">
          This note is empty.
        </div>
      </article>

      <!-- Footer -->
      <footer class="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Last updated {{ new Date(publishedNote.note_updated_at).toLocaleDateString() }}
          </span>
          <span v-if="publishedNote.owner_email">
            {{ publishedNote.owner_email }}
          </span>
        </div>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.note-content {
  color: rgb(17 24 39);
}

.dark .note-content {
  color: rgb(243 244 246);
}

.note-content :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.75;
}

.note-content :deep(h1) {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

.note-content :deep(h2) {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
}

.note-content :deep(h3) {
  font-size: 1.25rem;
  line-height: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
}

.note-content :deep(ul),
.note-content :deep(ol) {
  margin-bottom: 1rem;
  margin-left: 1.5rem;
}

.note-content :deep(li) {
  margin-bottom: 0.5rem;
}

.note-content :deep(code) {
  background-color: rgb(243 244 246);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.dark .note-content :deep(code) {
  background-color: rgb(31 41 55);
}

.note-content :deep(pre) {
  background-color: rgb(243 244 246);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.dark .note-content :deep(pre) {
  background-color: rgb(31 41 55);
}

.note-content :deep(blockquote) {
  border-left: 4px solid rgb(59 130 246);
  padding-left: 1rem;
  font-style: italic;
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.note-content :deep(a) {
  color: rgb(59 130 246);
  text-decoration: underline;
}

.note-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.note-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.note-content :deep(th),
.note-content :deep(td) {
  border: 1px solid rgb(209 213 219);
  padding: 0.5rem;
}

.dark .note-content :deep(th),
.dark .note-content :deep(td) {
  border-color: rgb(75 85 99);
}
</style>

