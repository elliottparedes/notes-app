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
  }
}

// Share function
async function shareLink() {
  if (isClient.value && navigator.share) {
    try {
      await navigator.share({ url: window.location.href });
    } catch (err) {
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
  <div class="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
    <!-- Header -->
    <header class="border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 flex-shrink-0 transition-all duration-300">
      <div class="max-w-4xl mx-auto px-6 py-4 w-full">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 flex-1 min-w-0">
            <div class="relative flex-shrink-0">
              <img src="/swan-unfold.png" alt="Unfold Notes" class="w-10 h-10 flex-shrink-0 transition-transform duration-300 hover:scale-110" />
            </div>
            <div class="flex-1 min-w-0">
              <h1 class="text-lg font-semibold text-gray-900 dark:text-white truncate transition-colors duration-200">
                {{ publishedNote?.note_title || 'Published Note' }}
              </h1>
              <p v-if="publishedNote?.owner_name" class="text-sm text-gray-500 dark:text-gray-400 truncate">
                Published by {{ publishedNote.owner_name }}
              </p>
            </div>
          </div>
          <div class="flex-shrink-0 ml-4">
            <UButton
              v-if="hasShareAPI"
              icon="i-heroicons-share"
              color="primary"
              variant="soft"
              size="sm"
              class="transition-all duration-200 hover:scale-105"
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
              class="transition-all duration-200 hover:scale-105"
              @click="copyLink"
            >
              Copy Link
            </UButton>
          </div>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center pt-[88px]">
      <div class="text-center space-y-4">
        <div class="relative">
          <div class="w-16 h-16 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin mx-auto"></div>
        </div>
        <p class="text-gray-500 dark:text-gray-400 animate-pulse">Loading note...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center pt-[88px]">
      <div class="text-center space-y-4 animate-fade-in">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 text-red-500 mx-auto" />
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Note Not Found</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ error }}</p>
      </div>
    </div>

    <!-- Note Content -->
    <main v-else-if="publishedNote" class="flex-1 overflow-y-auto pt-[88px]">
      <div class="max-w-4xl mx-auto px-6 py-12">
        <!-- Note Header -->
        <header class="mb-10 pb-8 border-b border-gray-200 dark:border-gray-800 animate-fade-in">
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {{ publishedNote.note_title }}
          </h1>
          <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span v-if="publishedNote.owner_name" class="flex items-center gap-1.5">
              <UIcon name="i-heroicons-user" class="w-4 h-4" />
              Published by {{ publishedNote.owner_name }}
            </span>
            <span class="flex items-center gap-1.5">
              <UIcon name="i-heroicons-clock" class="w-4 h-4" />
              Updated {{ new Date(publishedNote.note_updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
            </span>
          </div>
        </header>

        <!-- Note Content -->
        <article class="prose prose-lg dark:prose-invert max-w-none animate-fade-in-up">
          <div v-if="publishedNote.note_content" class="note-content" v-html="publishedNote.note_content"></div>
          <div v-else class="text-gray-500 dark:text-gray-400 italic text-center py-12">
            This note is empty.
          </div>
        </article>

        <!-- Footer -->
        <footer class="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800 animate-fade-in">
          <div class="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div class="flex items-center gap-2">
              <img src="/swan-unfold.png" alt="Unfold Notes" class="w-5 h-5" />
              <span>Published with Unfold Notes</span>
            </div>
            <div class="flex items-center gap-4">
              <span v-if="publishedNote.owner_email" class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-envelope" class="w-4 h-4" />
                {{ publishedNote.owner_email }}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Smooth animations */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out;
}

/* Transition animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-move {
  transition: transform 0.3s ease;
}

/* Note content styling */
.note-content {
  color: rgb(17 24 39);
  animation: fade-in-up 0.5s ease-out;
}

.dark .note-content {
  color: rgb(243 244 246);
}

.note-content :deep(p) {
  margin-bottom: 1.5rem;
  line-height: 1.8;
  font-size: 1.0625rem;
}

.note-content :deep(h1) {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  margin-top: 2.5rem;
  color: rgb(17 24 39);
}

.dark .note-content :deep(h1) {
  color: rgb(243 244 246);
}

.note-content :deep(h2) {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 2rem;
  color: rgb(17 24 39);
}

.dark .note-content :deep(h2) {
  color: rgb(243 244 246);
}

.note-content :deep(h3) {
  font-size: 1.5rem;
  line-height: 2rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
  color: rgb(17 24 39);
}

.dark .note-content :deep(h3) {
  color: rgb(243 244 246);
}

.note-content :deep(ul),
.note-content :deep(ol) {
  margin-bottom: 1.5rem;
  margin-left: 1.75rem;
}

.note-content :deep(li) {
  margin-bottom: 0.75rem;
  line-height: 1.8;
}

/* Task list styles */
.note-content :deep(ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
  margin-left: 0;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"]) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"] > label) {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  margin-top: 0.125rem;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"] > label input[type="checkbox"]) {
  cursor: pointer;
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
  border-radius: 0.25rem;
}

.note-content :deep(ul[data-type="taskList"] li[data-type="taskItem"][data-checked="true"] > div) {
  text-decoration: line-through;
  opacity: 0.6;
}

.note-content :deep(code) {
  background-color: rgb(243 244 246);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.dark .note-content :deep(code) {
  background-color: rgb(31 41 55);
}

.note-content :deep(pre) {
  background-color: rgb(243 244 246);
  padding: 1.25rem;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin-bottom: 1.5rem;
  border: 1px solid rgb(229 231 235);
}

.dark .note-content :deep(pre) {
  background-color: rgb(31 41 55);
  border-color: rgb(75 85 99);
}

.note-content :deep(blockquote) {
  border-left: 4px solid rgb(59 130 246);
  padding-left: 1.25rem;
  font-style: italic;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  color: rgb(107 114 128);
}

.dark .note-content :deep(blockquote) {
  color: rgb(156 163 175);
}

.note-content :deep(a) {
  color: rgb(59 130 246);
  text-decoration: underline;
  transition: color 0.2s;
}

.note-content :deep(a:hover) {
  color: rgb(37 99 235);
}

.note-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.75rem;
  margin: 2rem 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.note-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 2rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
}

.note-content :deep(th),
.note-content :deep(td) {
  border: 1px solid rgb(229 231 235);
  padding: 0.75rem;
}

.dark .note-content :deep(th),
.dark .note-content :deep(td) {
  border-color: rgb(75 85 99);
}

.note-content :deep(th) {
  background-color: rgb(249 250 251);
  font-weight: 600;
}

.dark .note-content :deep(th) {
  background-color: rgb(31 41 55);
}
</style>
