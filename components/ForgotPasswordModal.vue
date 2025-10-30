<script setup lang="ts">
const isOpen = defineModel<boolean>({ default: false });

const toast = useToast();
const email = ref('');
const loading = ref(false);
const submitted = ref(false);

function closeModal() {
  isOpen.value = false;
  // Reset form after closing
  setTimeout(() => {
    email.value = '';
    submitted.value = false;
  }, 300);
}

async function handleSubmit() {
  if (!email.value) {
    toast.add({
      title: 'Validation Error',
      description: 'Please enter your email address',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        email: email.value
      }
    });

    submitted.value = true;
    
    toast.add({
      title: 'Email Sent',
      description: 'Check your email for password reset instructions',
      color: 'success'
    });
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to send reset email. Please try again.',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div 
        v-if="isOpen" 
        class="fixed inset-0 z-50 overflow-y-auto"
        @click.self="closeModal"
      >
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/50 transition-opacity"></div>
        
        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div 
            class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            @click.stop
          >
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                Forgot Password?
              </h3>
              <button
                type="button"
                @click="closeModal"
                class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <!-- Content -->
            <div v-if="!submitted">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Enter your email address and we'll send you a temporary password to access your account.
              </p>

              <form @submit.prevent="handleSubmit" class="space-y-4">
                <div>
                  <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Email Address
                  </label>
                  <UInput
                    v-model="email"
                    type="email"
                    placeholder="you@example.com"
                    size="xl"
                    :disabled="loading"
                    class="w-full"
                    icon="i-heroicons-envelope"
                    required
                  />
                </div>

                <UButton
                  type="submit"
                  size="xl"
                  :loading="loading"
                  :disabled="loading"
                  class="w-full justify-center font-semibold"
                  color="primary"
                >
                  <span v-if="!loading">Send Reset Email</span>
                  <span v-else>Sending...</span>
                </UButton>
              </form>
            </div>

            <div v-else class="text-center py-4">
              <div class="mb-4">
                <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Check Your Email
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  If an account exists with <strong>{{ email }}</strong>, you'll receive an email with a temporary password shortly.
                </p>
              </div>

              <UButton
                size="lg"
                variant="outline"
                @click="closeModal"
                class="w-full justify-center"
              >
                Close
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>
