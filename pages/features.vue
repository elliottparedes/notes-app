<script setup lang="ts">
useHead({
  title: 'Features - Unfold Notes | Powerful Note-Taking Capabilities',
  meta: [
    {
      name: 'description',
      content: 'Discover all the powerful features of Unfold Notes: AI-powered writing, offline-first architecture, real-time collaboration, file attachments, PDF export, and more.'
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
            <NuxtLink to="/features" class="text-primary-600 dark:text-primary-400 font-medium">Features</NuxtLink>
            <NuxtLink to="/use-cases" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Use Cases</NuxtLink>
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

    <!-- Page Header -->
    <section class="pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 to-teal-50 dark:from-gray-800 dark:to-gray-900">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Powerful Features for Modern Note-Taking
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-400">
          Everything you need to organize, create, and collaborate on your notes
        </p>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto space-y-24">
        <!-- Feature 1: Rich Text Editor -->
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Rich Text Editor</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Write with ease using our beautiful, distraction-free editor. Format text, create lists, insert images, and structure your content exactly how you want it.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Full rich text formatting (bold, italic, headings, lists)</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Tables, code blocks, and blockquotes</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Keyboard shortcuts for power users</span>
              </li>
            </ul>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">Editor Preview</p>
          </div>
        </div>

        <!-- Feature 2: AI-Powered -->
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div class="order-2 md:order-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">AI Preview</p>
          </div>
          <div class="order-1 md:order-2">
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">AI-Powered Writing</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Let AI help you create better notes. Generate content, polish your writing, and get intelligent suggestions powered by Google Gemini.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Generate notes from prompts</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Polish and improve existing content</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Get writing suggestions and improvements</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Feature 3: Offline-First -->
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-wifi" class="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Offline-First Architecture</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Your notes work everywhere, even without internet. Built as a Progressive Web App (PWA) with full offline support.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Full functionality without internet connection</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Automatic sync when connection is restored</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Install as a native app on any device</span>
              </li>
            </ul>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">Offline Preview</p>
          </div>
        </div>

        <!-- Feature 4: Collaboration -->
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div class="order-2 md:order-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">Collaboration Preview</p>
          </div>
          <div class="order-1 md:order-2">
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-user-group" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Real-Time Collaboration</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Work together with your team. Share notes, see live cursors, and collaborate in real-time.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Live cursors and presence indicators</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Share with view or edit permissions</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Perfect for teams and knowledge sharing</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Feature 5: Organization -->
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-folder" class="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Smart Organization</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Organize your notes with spaces, folders, and tags. Find anything instantly with powerful search.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Create nested folders and spaces</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Tag notes for easy categorization</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Full-text search across all your notes</span>
              </li>
            </ul>
          </div>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">Organization Preview</p>
          </div>
        </div>

        <!-- Feature 6: File Attachments & Export -->
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div class="order-2 md:order-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-8 min-h-[300px] flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">Attachments Preview</p>
          </div>
          <div class="order-1 md:order-2">
            <div class="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-paper-clip" class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">File Attachments & Export</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
              Attach files to your notes and export them as beautiful PDFs. 500MB of storage included free.
            </p>
            <ul class="space-y-2 text-gray-600 dark:text-gray-400">
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Upload images, documents, and files</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>Export notes as professionally formatted PDFs</span>
              </li>
              <li class="flex items-start gap-2">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                <span>500MB free storage per user</span>
              </li>
            </ul>
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
  </div>
</template>


