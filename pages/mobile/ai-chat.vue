<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useToast } from '~/composables/useToast';

const authStore = useAuthStore();
const toast = useToast();

// Markdown to HTML converter (compact spacing)
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Code blocks (```code```) - handle first to avoid conflicts
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const codeContent = code.trim();
    return `<pre class="bg-gray-800 dark:bg-gray-900 text-gray-100 p-2.5 rounded-lg overflow-x-auto my-1 text-xs"><code>${escapeHtml(codeContent)}</code></pre>`;
  });
  
  // Inline code (`code`) - must come after code blocks
  html = html.replace(/`([^`\n]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
  
  // Headers (compact spacing)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-1.5 mb-0.5">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-1.5 mb-0.5">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-1.5 mb-0.5">$1</h1>');
  
  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong class="font-semibold">$1</strong>');
  
  // Italic (*text* or _text_) - but not inside bold or code
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em class="italic">$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em class="italic">$1</em>');
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Blockquotes (> text) - compact
  html = html.replace(/^> (.+)$/gim, '<blockquote class="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-0.5 italic text-gray-600 dark:text-gray-400 text-sm">$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="my-1 border-gray-300 dark:border-gray-600">');
  html = html.replace(/^\*\*\*$/gim, '<hr class="my-1 border-gray-300 dark:border-gray-600">');
  
  // Process line by line for better control
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      if (inList && listItems.length > 0) {
        processedLines.push(`<${listType} class="ml-4 my-0.5 space-y-0">${listItems.join('')}</${listType}>`);
        listItems = [];
        inList = false;
        listType = null;
      }
      continue;
    }
    
    const ulMatch = trimmed.match(/^[\*\-\+] (.+)$/);
    const olMatch = trimmed.match(/^\d+[\.\)]\s*(.+)$/);
    
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList && listItems.length > 0) {
          processedLines.push(`<${listType} class="ml-4 my-0.5 space-y-0">${listItems.join('')}</${listType}>`);
          listItems = [];
        }
        inList = true;
        listType = 'ul';
      }
      listItems.push(`<li class="list-disc">${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList && listItems.length > 0) {
          processedLines.push(`<${listType} class="ml-4 my-0.5 space-y-0">${listItems.join('')}</${listType}>`);
          listItems = [];
        }
        inList = true;
        listType = 'ol';
      }
      // Use proper <ol> with list-decimal, which will auto-number
      listItems.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inList && listItems.length > 0) {
        processedLines.push(`<${listType} class="ml-4 my-0.5 space-y-0">${listItems.join('')}</${listType}>`);
        listItems = [];
        inList = false;
        listType = null;
      }
      
      // Check if it's already a block element
      if (trimmed.startsWith('<') && (trimmed.match(/^<(h[1-6]|pre|blockquote|hr|ul|ol)/))) {
        processedLines.push(trimmed);
      } else {
        // Regular paragraph - minimal spacing
        processedLines.push(`<p class="my-0.5 leading-relaxed">${trimmed}</p>`);
      }
    }
  }
  
  if (inList && listItems.length > 0) {
    processedLines.push(`<${listType} class="ml-4 my-0.5 space-y-0">${listItems.join('')}</${listType}>`);
  }
  
  html = processedLines.join('');
  
  // Clean up: remove empty paragraphs
  html = html.replace(/<p class="my-0.5 leading-relaxed"><\/p>/g, '');
  
  return html;
}

function escapeHtml(text: string): string {
  if (!process.client) {
    // Server-side fallback
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const messages = ref<Message[]>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const messagesEndRef = ref<HTMLElement | null>(null);

// Scroll to bottom when new message is added
watch(messages, () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
}, { deep: true });

const isInputFocused = ref(false);

async function sendMessage() {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date()
  };

  messages.value.push(userMessage);
  const currentInput = inputMessage.value.trim();
  inputMessage.value = '';
  isLoading.value = true;

  try {
    if (!authStore.token) {
      toast.error('Not authenticated');
      return;
    }

    // Call our API endpoint
    const response = await $fetch<{ content: string }>('/api/ai/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        messages: messages.value.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }
    });

    const aiResponse = response.content;
    
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    };

    messages.value.push(assistantMessage);
  } catch (error: any) {
    console.error('AI chat error:', error);
    toast.error(error.data?.message || error.message || 'Failed to get AI response');
    
    // Add error message
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Sorry, I encountered an error. Please try again.',
      timestamp: new Date()
    };
    messages.value.push(errorMessage);
  } finally {
    isLoading.value = false;
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// Helper to check if we're on mobile (client-side only)
const isMobileView = computed(() => {
  if (!process.client) return false;
  return window.innerWidth < 1024;
});

// Responsive routing - redirect to dashboard if screen becomes desktop
watch(isMobileView, (isMobile) => {
  if (!isMobile && process.client) {
    // Screen became desktop size, redirect to dashboard
    router.replace('/dashboard');
  }
}, { immediate: false });

onMounted(() => {
  // Redirect if on desktop
  if (!isMobileView.value) {
    router.replace('/dashboard');
    return;
  }

  nextTick(() => {
    inputRef.value?.focus();
  });

  // Listen for window resize
  const handleResize = () => {
    if (window.innerWidth >= 1024) {
      router.replace('/dashboard');
    }
  };

  window.addEventListener('resize', handleResize);
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });
});
</script>

<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-900 lg:hidden">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-50">AI Assistant</h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Ask quick questions (history not saved)</p>
    </div>

    <!-- Messages -->
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-4">
      <!-- Empty State -->
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-sparkles" class="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">Ask me anything</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          I'm here to help with quick questions. Your conversation history won't be saved.
        </p>
      </div>

      <!-- Messages List -->
      <div v-else class="space-y-4">
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[85%] rounded-2xl px-4 py-3"
            :class="message.role === 'user' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'"
          >
            <div 
              v-if="message.role === 'user'"
              class="text-sm whitespace-pre-wrap break-words"
            >
              {{ message.content }}
            </div>
            <div 
              v-else
              class="text-sm break-words prose prose-sm dark:prose-invert max-w-none"
              v-html="markdownToHtml(message.content)"
            />
            <p class="text-xs mt-1.5 opacity-70">
              {{ message.timestamp.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }}
            </p>
          </div>
        </div>

        <!-- Loading Indicator -->
        <div v-if="isLoading" class="flex justify-start">
          <div class="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
          </div>
        </div>
      </div>

      <div ref="messagesEndRef" />
    </div>

    <!-- Input Area -->
    <div 
      class="px-4 pt-3 pb-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all duration-200"
    >
      <div class="flex items-end gap-2">
        <div class="flex-1 relative">
          <input
            ref="inputRef"
            v-model="inputMessage"
            @keydown="handleKeydown"
            @focus="isInputFocused = true"
            @blur="isInputFocused = false"
            type="text"
            placeholder="Ask a question..."
            :disabled="isLoading"
            class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || isLoading"
          class="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <UIcon 
            v-if="!isLoading"
            name="i-heroicons-paper-airplane" 
            class="w-5 h-5" 
          />
          <UIcon 
            v-else
            name="i-heroicons-arrow-path" 
            class="w-5 h-5 animate-spin" 
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth scrolling */
.overflow-y-auto {
  scroll-behavior: smooth;
}

/* Markdown styling */
:deep(.prose) {
  color: inherit;
}

:deep(.prose h1),
:deep(.prose h2),
:deep(.prose h3) {
  color: inherit;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

:deep(.prose p) {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

:deep(.prose code) {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.dark :deep(.prose code) {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.prose pre) {
  margin: 0.5rem 0;
}

:deep(.prose pre code) {
  background-color: transparent;
  padding: 0;
}

:deep(.prose ul),
:deep(.prose ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

:deep(.prose li) {
  margin: 0.25rem 0;
}

:deep(.prose blockquote) {
  margin: 0.5rem 0;
  padding-left: 1rem;
  border-left: 4px solid currentColor;
  opacity: 0.8;
}

:deep(.prose a) {
  text-decoration: underline;
}

:deep(.prose hr) {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid currentColor;
  opacity: 0.3;
}
</style>

