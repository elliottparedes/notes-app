<script setup lang="ts">
const { setPageSEO, baseUrl } = useSEO()

setPageSEO({
  title: 'About Unfold Notes - Our Mission, Story & Values',
  description: 'Learn about Unfold Notes - a modern note-taking app built with a focus on collaboration and beautiful design. Created by Elliott with a mission to make note-taking accessible everywhere.',
  path: '/about',
  keywords: [
    'about unfold notes',
    'note taking app story',
    'offline notes mission',
    'note app creator',
    'unfold notes about'
  ],
  schema: {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Unfold Notes',
    description: 'Learn about Unfold Notes, its mission, values, and the story behind this modern note-taking app.',
    url: `${baseUrl}/about`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: baseUrl
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'About',
          item: `${baseUrl}/about`
        }
      ]
    }
  }
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <!-- Navigation -->
    <nav class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <NuxtLink to="/" class="flex items-center gap-2">
            <img src="/swan-unfold.png" alt="Unfold Notes" class="w-8 h-8" />
            <span class="text-xl font-bold text-gray-900 dark:text-white">Unfold Notes</span>
          </NuxtLink>
          
          <div class="hidden md:flex items-center gap-6">
            <NuxtLink to="/features" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</NuxtLink>
            <NuxtLink to="/use-cases" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Use Cases</NuxtLink>
            <NuxtLink to="/about" class="text-primary-600 dark:text-primary-400 font-medium">About</NuxtLink>
            <NuxtLink to="/faq" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</NuxtLink>
          </div>
          
          <div class="flex items-center gap-3">
            <UButton to="/login" variant="ghost" size="sm">Sign In</UButton>
            <UButton to="/signup" color="primary" size="sm">Get Started</UButton>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 to-teal-50 dark:from-gray-800 dark:to-gray-900">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          About Unfold Notes
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-400">
          A note-taking app built with passion for modern workflows
        </p>
      </div>
    </section>

    <!-- Content -->
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-4xl mx-auto prose prose-lg dark:prose-invert max-w-none">
        <div class="space-y-8">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              Unfold Notes was created to solve a simple problem: note-taking apps shouldn't require constant internet connection, and they should work beautifully everywhere. We believe that your thoughts are too important to be locked behind slow connections or confusing interfaces.
            </p>
          </div>

          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Why We Built It</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              Traditional note-taking apps often fail when you need them most - on flights, in remote locations, or during internet outages. Unfold Notes includes offline support, helping ensure your notes are accessible when you need them.
            </p>
            <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              We also wanted to combine the best of both worlds: the power of modern AI assistance with the simplicity of clean, distraction-free writing. Add real-time collaboration and beautiful organization, and you have Unfold Notes.
            </p>
          </div>

          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Values</h2>
            <div class="grid md:grid-cols-2 gap-6 mt-6">
              <div class="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Privacy First</h3>
                <p class="text-gray-600 dark:text-gray-400">
                  Your notes are yours. We don't sell your data, and we don't track your content. Everything is encrypted and secure.
                </p>
              </div>
              <div class="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Offline Support</h3>
                <p class="text-gray-600 dark:text-gray-400">
                  Works everywhere, even without internet. Your notes sync automatically when you're back online.
                </p>
              </div>
              <div class="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Beautiful Design</h3>
                <p class="text-gray-600 dark:text-gray-400">
                  We believe software should be a joy to use. Every interaction is designed with care and attention to detail.
                </p>
              </div>
              <div class="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Always Improving</h3>
                <p class="text-gray-600 dark:text-gray-400">
                  Unfold Notes is continuously evolving based on user feedback. Your ideas shape the future of the product.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Built by Elliott</h2>
            <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              Unfold Notes is an indie project created and maintained by Elliott. As a solo developer, Elliott built Unfold Notes to scratch his own itch for a better note-taking experience. What started as a personal project has grown into a full-featured app used by people around the world.
            </p>
            <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
              If you find Unfold Notes useful, consider supporting its development. Every bit helps keep the servers running and new features coming.
            </p>
            <div class="mt-6">
              <BuyMeACoffee variant="button" size="lg" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary-600 via-emerald-600 to-teal-600">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="text-4xl font-bold text-white mb-6">Join Us</h2>
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
              <img src="/swan-unfold.png" alt="Unfold Notes" class="w-6 h-6" />
              <span class="text-white font-bold">Unfold Notes</span>
            </div>
            <p class="text-sm">Organize your thoughts with a modern note-taking app.</p>
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


