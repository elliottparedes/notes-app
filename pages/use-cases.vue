<script setup lang="ts">
const selectedImage = ref<string | null>(null);

function openImageModal(imageSrc: string) {
  selectedImage.value = imageSrc;
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  selectedImage.value = null;
  document.body.style.overflow = '';
}

// Close on ESC key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && selectedImage.value) {
    closeImageModal();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  document.body.style.overflow = '';
});

useHead({
  title: 'Use Cases - How to Use Unfold Notes | Productivity Solutions',
  meta: [
    {
      name: 'description',
      content: 'Discover how Unfold Notes can help with personal note-taking, team collaboration, research documentation, meeting notes, project planning, and knowledge management.'
    }
  ]
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <!-- Navigation -->
    <nav class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <NuxtLink to="/" class="flex items-center gap-2">
            <img src="/folder.png" alt="Unfold Notes" class="w-8 h-8" />
            <span class="text-xl font-bold text-gray-900 dark:text-white">Unfold Notes</span>
          </NuxtLink>
          
          <div class="hidden md:flex items-center gap-6">
            <NuxtLink to="/features" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</NuxtLink>
            <NuxtLink to="/use-cases" class="text-primary-600 dark:text-primary-400 font-medium">Use Cases</NuxtLink>
            <NuxtLink to="/about" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">About</NuxtLink>
            <NuxtLink to="/faq" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</NuxtLink>
          </div>
          
          <div class="flex items-center gap-3">
            <UButton to="/login" variant="ghost" size="sm">Sign In</UButton>
            <UButton to="/signup" color="primary" size="sm">Get Started</UButton>
          </div>
        </div>
      </div>
    </nav>

    <!-- Header -->
    <section class="pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 to-teal-50 dark:from-gray-800 dark:to-gray-900">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          How People Use Unfold Notes
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-400">
          Discover the many ways Unfold Notes helps organize thoughts and boost productivity
        </p>
      </div>
    </section>

    <!-- Use Cases -->
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto space-y-16">
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-user" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Personal Note-Taking</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Capture your thoughts, ideas, and inspiration wherever you are. Whether you're journaling, brainstorming, or keeping personal notes, Unfold Notes works offline so you never lose an idea.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Daily journaling and reflection</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Idea capture and brainstorming</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Personal knowledge management</span>
              </li>
            </ul>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer transition-transform hover:scale-[1.02]" @click="openImageModal('/personal-notes.png')">
            <img src="/personal-notes.png" alt="Personal Notes Preview" class="w-full h-full object-cover" />
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div class="order-2 md:order-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer transition-transform hover:scale-[1.02]" @click="openImageModal('/collab.png')">
            <img src="/collab.png" alt="Team Collaboration Preview" class="w-full h-full object-cover" />
          </div>
          <div class="order-1 md:order-2">
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-user-group" class="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Team Collaboration</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Share knowledge and collaborate in real-time. Perfect for teams building documentation, sharing meeting notes, or working together on projects.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Team knowledge bases</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Shared documentation</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Real-time collaborative editing</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-academic-cap" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Research & Documentation</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Organize your research, attach sources, and build comprehensive documentation. Perfect for students, researchers, and writers.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Research note-taking with citations</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Attach PDFs and source materials</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Export research as PDFs</span>
              </li>
            </ul>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer transition-transform hover:scale-[1.02]" @click="openImageModal('/research.png')">
            <img src="/research.png" alt="Research Preview" class="w-full h-full object-cover" />
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div class="order-2 md:order-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer transition-transform hover:scale-[1.02]" @click="openImageModal('/meeting-notes.png')">
            <img src="/meeting-notes.png" alt="Meeting Notes Preview" class="w-full h-full object-cover" />
          </div>
          <div class="order-1 md:order-2">
            <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-calendar" class="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Meeting Notes</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Take comprehensive meeting notes and share them instantly with your team. Attach files, export as PDFs, and keep everyone aligned.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Structured meeting documentation</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Share notes with action items</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Attach meeting slides and resources</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-clipboard-document-check" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Project Planning</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Plan projects, track tasks, and organize team information. Use folders and spaces to keep everything structured and accessible.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Project documentation</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Task lists and checklists</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Organize by spaces and folders</span>
              </li>
            </ul>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer transition-transform hover:scale-[1.02]" @click="openImageModal('/project-planning.png')">
            <img src="/project-planning.png" alt="Project Planning Preview" class="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary-600 via-emerald-600 to-teal-600">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
        <p class="text-xl text-primary-100 mb-8">
          Start organizing your thoughts with Unfold Notes today
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <UButton to="/signup" size="lg" variant="solid" class="font-semibold px-6 bg-white text-primary-600 hover:bg-gray-100">
            Get Started Free
          </UButton>
          <UButton to="/login" size="lg" variant="outline" class="font-semibold px-6 border-white text-white hover:bg-white/10">
            Sign In
          </UButton>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div class="flex items-center gap-2 mb-4">
              <img src="/folder.png" alt="Unfold Notes" class="w-6 h-6" />
              <span class="text-white font-bold">Unfold Notes</span>
            </div>
            <p class="text-sm">Organize your thoughts with a modern, offline-first note-taking app.</p>
          </div>
          <div>
            <h3 class="text-white font-semibold mb-4">Product</h3>
            <ul class="space-y-2 text-sm">
              <li><NuxtLink to="/features" class="hover:text-white transition-colors">Features</NuxtLink></li>
              <li><NuxtLink to="/use-cases" class="hover:text-white transition-colors">Use Cases</NuxtLink></li>
            </ul>
          </div>
          <div>
            <h3 class="text-white font-semibold mb-4">Company</h3>
            <ul class="space-y-2 text-sm">
              <li><NuxtLink to="/about" class="hover:text-white transition-colors">About</NuxtLink></li>
              <li><NuxtLink to="/faq" class="hover:text-white transition-colors">FAQ</NuxtLink></li>
            </ul>
          </div>
          <div>
            <h3 class="text-white font-semibold mb-4">Account</h3>
            <ul class="space-y-2 text-sm">
              <li><NuxtLink to="/login" class="hover:text-white transition-colors">Sign In</NuxtLink></li>
              <li><NuxtLink to="/signup" class="hover:text-white transition-colors">Sign Up</NuxtLink></li>
            </ul>
          </div>
        </div>
        <div class="border-t border-gray-800 pt-8 text-center text-sm">
          <p>&copy; {{ new Date().getFullYear() }} Unfold Notes. Made with ❤️ by Elliott.</p>
        </div>
      </div>
    </footer>

    <!-- Fullscreen Image Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-300"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="selectedImage"
          class="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          @click="closeImageModal"
        >
          <!-- Close Button -->
          <button
            @click="closeImageModal"
            class="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white transition-all hover:scale-110"
            aria-label="Close image"
          >
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>

          <!-- Image Container -->
          <div
            @click.stop
            class="relative max-w-7xl w-full h-full flex items-center justify-center"
          >
            <Transition
              enter-active-class="transition-all duration-300"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-300"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
            >
              <img
                v-if="selectedImage"
                :src="selectedImage"
                alt="Fullscreen preview"
                class="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              />
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>


