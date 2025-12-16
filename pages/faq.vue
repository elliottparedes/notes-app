<script setup lang="ts">
const { setPageSEO, baseUrl } = useSEO()

// Enhanced FAQ schema with all questions
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Unfold Notes?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Unfold Notes is a modern note-taking app that helps you organize your thoughts with AI-powered features and beautiful organization tools. It works everywhere - on desktop, mobile, and tablets.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is Unfold Notes free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Unfold Notes is completely free to use. We provide 500MB of free storage per user, which is perfect for most note-taking needs. You can attach files and use all features without any payment required.'
      }
    },
    {
      '@type': 'Question',
      name: 'How much storage do I get?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every user gets 500MB of free storage for file attachments. You can check your storage usage in the Settings page. If you need more storage, you can delete old attachments to free up space.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is my data secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, your data is secure and private. All authentication is handled securely with JWT tokens, and passwords are hashed using bcrypt. We don\'t sell your data or track your content. Your notes belong to you.'
      }
    },
    {
      '@type': 'Question',
      name: 'Does Unfold Notes have AI features?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Unfold Notes includes AI-powered features powered by Google Gemini. You can generate notes from prompts, polish your writing, and get intelligent suggestions to improve your content.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can I use Unfold Notes on mobile?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Unfold Notes is a Progressive Web App that works perfectly on mobile devices. You can install it on your phone\'s home screen and use it like a native app. It\'s fully responsive and optimized for touch interactions.'
      }
    }
  ]
}

setPageSEO({
  title: 'FAQ - Frequently Asked Questions | Unfold Notes Help',
  description: 'Frequently asked questions about Unfold Notes. Learn about features, pricing, security, AI features, mobile support, and more. Get answers to common questions.',
  path: '/faq',
  keywords: [
    'unfold notes faq',
    'note taking app questions',
    'note app support',
    'unfold notes help'
  ],
  schema: faqSchema
});

const faqs = [
  {
    question: 'What is Unfold Notes?',
    answer: 'Unfold Notes is a modern note-taking app that helps you organize your thoughts with AI-powered features and beautiful organization tools. It works everywhere - on desktop, mobile, and tablets.'
  },
  {
    question: 'Is Unfold Notes free to use?',
    answer: 'Yes! Unfold Notes is completely free to use. We provide 500MB of free storage per user, which is perfect for most note-taking needs. You can attach files and use all features without any payment required.'
  },
  {
    question: 'What file types can I attach?',
    answer: 'You can attach any file type to your notes - images, documents, PDFs, and more. Each user gets 500MB of free storage space to use for attachments.'
  },
  {
    question: 'How much storage do I get?',
    answer: 'Every user gets 500MB of free storage for file attachments. You can check your storage usage in the Settings page. If you need more storage, you can delete old attachments to free up space.'
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, your data is secure and private. All authentication is handled securely with JWT tokens, and passwords are encrypted using bcrypt. We don\'t sell your data or track your content. Your notes belong to you.'
  },
  {
    question: 'Does Unfold Notes have AI features?',
    answer: 'Yes! Unfold Notes includes AI-powered features powered by Google Gemini. You can generate notes from prompts, polish your writing, and get intelligent suggestions to improve your content.'
  },
  {
    question: 'Can I use Unfold Notes on mobile?',
    answer: 'Yes! Unfold Notes is a Progressive Web App that works perfectly on mobile devices. You can install it on your phone\'s home screen and use it like a native app. It\'s fully responsive and optimized for touch interactions.'
  },
  {
    question: 'How do I get started?',
    answer: 'Simply sign up for a free account! No credit card required. Once you create your account, you can start creating notes immediately. You can organize them with folders, add tags, and attach files.'
  },
  {
    question: 'What happens to my notes if I stop using Unfold Notes?',
    answer: 'Your notes are always yours. You can download your data at any time. If you decide to leave, your data won\'t be deleted automatically - you maintain full control.'
  }
];

const openFaqs = ref<number[]>([]);

function toggleFaq(index: number) {
  if (openFaqs.value.includes(index)) {
    openFaqs.value = openFaqs.value.filter(i => i !== index);
  } else {
    openFaqs.value.push(index);
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <!-- Navigation -->
    <nav class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <NuxtLink to="/" class="flex items-center gap-2">
            <img src="/note_book_logo.png" alt="Unfold Notes" class="w-8 h-8" />
            <span class="text-xl font-bold text-gray-900 dark:text-white">Unfold Notes</span>
          </NuxtLink>
          
          <div class="hidden md:flex items-center gap-6">
            <NuxtLink to="/features" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</NuxtLink>
            <NuxtLink to="/use-cases" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Use Cases</NuxtLink>
            <NuxtLink to="/about" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">About</NuxtLink>
            <NuxtLink to="/faq" class="text-indigo dark:text-primary-400 font-medium">FAQ</NuxtLink>
          </div>
          
          <div class="flex items-center gap-3">
            <UButton to="/login" variant="ghost" size="sm" class="!text-indigo-600 dark:!text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10">Sign In</UButton>
            <UButton to="/signup" size="sm" class="!bg-indigo-600 hover:!bg-indigo-700 text-white dark:!bg-indigo-500 dark:hover:!bg-indigo-600">Get Started</UButton>
          </div>
        </div>
      </div>
    </nav>

    <!-- Header -->
    <section class="pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          Frequently Asked Questions
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-400">
          Everything you need to know about Unfold Notes
        </p>
      </div>
    </section>

    <!-- FAQ Items -->
    <section class="py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto space-y-4">
        <div
          v-for="(faq, index) in faqs"
          :key="index"
          class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <button
            @click="toggleFaq(index)"
            class="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span class="font-semibold text-gray-900 dark:text-white text-lg">
              {{ faq.question }}
            </span>
            <UIcon
              name="i-heroicons-chevron-down"
              class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ml-4"
              :class="{ 'rotate-180': openFaqs.includes(index) }"
            />
          </button>
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="max-h-0 opacity-0"
            enter-to-class="max-h-96 opacity-100"
            leave-active-class="transition-all duration-300 ease-in"
            leave-from-class="max-h-96 opacity-100"
            leave-to-class="max-h-0 opacity-0"
          >
            <div
              v-if="openFaqs.includes(index)"
              class="px-6 pb-4 text-gray-600 dark:text-gray-400 leading-relaxed"
            >
              {{ faq.answer }}
            </div>
          </Transition>
        </div>
      </div>
    </section>

    <!-- Still Have Questions -->
    <section class="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-800">
      <div class="max-w-3xl mx-auto text-center">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Still Have Questions?
        </h2>
        <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Feel free to reach out or explore our other pages to learn more
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <UButton to="/about" variant="outline" size="lg" class="!text-indigo-600 dark:!text-indigo-400 !ring-indigo-600 dark:!ring-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
            Learn More
          </UButton>
          <UButton to="/signup" size="lg" class="!bg-indigo-600 hover:!bg-indigo-700 text-white dark:!bg-indigo-500 dark:hover:!bg-indigo-600">
            Get Started
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
              <img src="/note_book_logo.png" alt="Unfold Notes" class="w-6 h-6" />
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


