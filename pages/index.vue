<script setup lang="ts">
const { setPageSEO, baseUrl } = useSEO()

setPageSEO({
  title: 'Unfold Notes - Free Note-Taking App with AI | Organize Your Thoughts',
  description: 'Unfold Notes is a free note-taking app with AI-powered features and beautiful organization. Works everywhere - desktop and mobile. Start organizing your thoughts today.',
  path: '/',
  keywords: [
    'note taking app',
    'free note app',
    'markdown editor',
    'AI note taking',
    'PWA notes',
    'note taking software',
    'organize notes',
    'productivity app',
    'note app free',
    'best note app',
    'note taking tool'
  ],
  schema: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Unfold Notes',
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Web, PWA, iOS, Android',
    description: 'Modern note-taking app with AI-powered features and beautiful organization.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150'
    },
    featureList: [
      'PWA Support - Install on any device',
      'AI-powered note generation with Google Gemini',
      'Rich text editing with markdown support',
      'File attachments up to 500MB free',
      'PDF export',
      'Dark mode',
      'Full-text search',
      'Organize with folders and spaces',
      'Share notes with public links'
    ],
    url: baseUrl,
    author: {
      '@type': 'Person',
      name: 'Elliott'
    }
  }
})

// Check if user is already logged in
const authStore = useAuthStore();
const router = useRouter();

onMounted(() => {
  if (authStore.token && authStore.currentUser) {
    router.push('/dashboard');
  }
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <!-- Navigation -->
    <nav class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-2">
            <img src="/swan-unfold.png" alt="Unfold Notes" class="w-8 h-8" />
            <span class="text-xl font-bold text-gray-900 dark:text-white">Unfold Notes</span>
          </div>
          
          <div class="hidden md:flex items-center gap-6">
            <NuxtLink to="/features" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Features
            </NuxtLink>
            <NuxtLink to="/use-cases" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Use Cases
            </NuxtLink>
            <NuxtLink to="/about" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              About
            </NuxtLink>
            <NuxtLink to="/faq" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              FAQ
            </NuxtLink>
          </div>
          
          <div class="flex items-center gap-3">
            <UButton to="/login" variant="ghost" size="sm">
              Sign In
            </UButton>
            <UButton to="/signup" color="primary" size="sm">
              Get Started
            </UButton>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative overflow-hidden pt-20 pb-32 px-4 sm:px-6 lg:px-8" aria-label="Hero section">
      <div class="max-w-7xl mx-auto">
        <div class="text-center">
          <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Unfold Your
            <span class="bg-gradient-to-r from-primary-600 to-teal-600 bg-clip-text text-transparent">
              Thinking
            </span>
          </h1>
          <p class="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            A modern note-taking app that works everywhere. Organize your thoughts with AI-powered features and beautiful organization. Free forever with 500MB storage included.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <UButton to="/signup" size="lg" color="primary" class="font-semibold px-6">
              Start Free
            </UButton>
            <UButton to="/login" size="lg" variant="outline" class="font-semibold px-6">
              Sign In
            </UButton>
          </div>
          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            No credit card required • Free forever
          </p>
        </div>
      </div>
      
      <!-- Background decoration -->
      <div class="absolute inset-0 -z-10 overflow-hidden">
        <div class="absolute top-0 left-1/4 w-96 h-96 bg-primary-200 dark:bg-primary-900 rounded-full blur-3xl opacity-30"></div>
        <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200 dark:bg-teal-900 rounded-full blur-3xl opacity-30"></div>
      </div>
    </section>

    <!-- Key Benefits -->
    <section class="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800" aria-label="Key benefits">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Everything You Need to Organize Your Thoughts
          </h2>
          <p class="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Built for modern workflows with powerful features. Perfect for students, professionals, teams, and anyone who wants to capture ideas instantly.
          </p>
        </div>
        
        <div class="flex justify-center">
          <div class="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md">
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
              <UIcon name="i-heroicons-sparkles" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">AI-Powered</h3>
            <p class="text-gray-600 dark:text-gray-400 text-center">
              Generate notes with AI assistance. Polish your writing, organize thoughts, and get suggestions powered by Google Gemini.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Preview -->
    <section class="py-24 px-4 sm:px-6 lg:px-8" aria-label="Features preview">
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Powerful Features for Modern Workflows
          </h2>
          <p class="text-xl text-gray-600 dark:text-gray-400">
            Everything you need in one beautiful app. From AI-powered writing to smart organization, Unfold Notes has all the features you need to stay productive.
          </p>
        </div>
        
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">Rich Text Editor</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Beautiful, distraction-free editing experience</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-folder" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">Organize with Spaces</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Folders and spaces for perfect organization</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-paper-clip" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">File Attachments</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Attach files, images, and documents</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-document-arrow-down" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">PDF Export</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Export your notes as beautiful PDFs</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-magnifying-glass" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">Fast Search</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Find anything instantly with full-text search</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-moon" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">Dark Mode</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Easy on the eyes, day or night</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-globe-alt" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">Publish & Share</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Share your notes with anyone via public links</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-device-phone-mobile" class="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-1">PWA Support</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Install on any device, works like a native app</p>
            </div>
          </div>
        </div>
        
        <div class="text-center mt-12">
          <UButton to="/features" size="lg" variant="outline">
            View All Features →
          </UButton>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary-600 via-emerald-600 to-teal-600">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="text-4xl md:text-5xl font-bold text-white mb-6">
          Ready to Unfold Your Thinking?
        </h2>
        <p class="text-xl text-primary-100 mb-8">
          Join thousands of users organizing their thoughts with Unfold Notes
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
              <img src="/swan-unfold.png" alt="Unfold Notes" class="w-6 h-6" />
              <span class="text-white font-bold">Unfold Notes</span>
            </div>
            <p class="text-sm">
              Organize your thoughts with a modern note-taking app.
            </p>
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
