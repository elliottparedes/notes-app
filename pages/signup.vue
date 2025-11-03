<script setup lang="ts">
import type { UserSignupDto } from '~/models';

const authStore = useAuthStore();
const toast = useToast();

const form = reactive<UserSignupDto>({
  email: '',
  password: '',
  name: ''
});

const loading = ref(false);

async function handleSignup() {
  if (!form.email || !form.password) {
    toast.add({
      title: 'Validation Error',
      description: 'Email and password are required',
      color: 'error'
    });
    return;
  }

  if (form.password.length < 6) {
    toast.add({
      title: 'Validation Error',
      description: 'Password must be at least 6 characters long',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    // Signup will automatically navigate to dashboard on success
    await authStore.signup(form);
    
    // Success toast is shown after navigation
    toast.add({
      title: 'Success',
      description: 'Account created successfully!',
      color: 'success'
    });
  } catch (error: unknown) {
    loading.value = false;
    toast.add({
      title: 'Signup Failed',
      description: error instanceof Error ? error.message : 'Failed to create account',
      color: 'error'
    });
  }
  // Don't set loading to false on success - let navigation happen
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Left Side - Marketing -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 relative overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 opacity-5">
        <div class="absolute inset-0" style="background-image: radial-gradient(circle at 25px 25px, white 2%, transparent 0%), radial-gradient(circle at 75px 75px, white 2%, transparent 0%); background-size: 100px 100px;"></div>
      </div>
      
      <!-- Gradient Orbs -->
      <div class="absolute top-20 left-20 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl"></div>
      <div class="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl"></div>
      
      <div class="relative z-10 flex flex-col justify-center px-12 xl:px-16 text-white">
        <h1 class="text-4xl xl:text-5xl font-bold mb-6 leading-tight">
          Your Ideas,<br />Organized & Accessible
        </h1>
        
        <p class="text-xl text-slate-300 mb-12 leading-relaxed">
          Create, organize, and collaborate on beautiful markdown notes. Sync seamlessly across all your devices.
        </p>
        
        <div class="space-y-6">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
              <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-1">Rich Markdown Editor</h3>
              <p class="text-slate-400 text-sm">Write with ease using our powerful, intuitive editor</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-500/20 backdrop-blur-sm flex items-center justify-center">
              <svg class="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-1">Smart Organization</h3>
              <p class="text-slate-400 text-sm">Organize your notes with folders</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
              <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-1">Real-time Collaboration</h3>
              <p class="text-slate-400 text-sm">Share and collaborate with your team instantly</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Sign Up Form -->
    <div class="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <div class="relative">
            <div class="absolute inset-0 bg-gradient-to-br from-primary-400 via-emerald-500 to-teal-600 rounded-3xl blur-xl opacity-30"></div>
            <img src="/folder.png" alt="Markdown Notes" class="relative w-20 h-20 drop-shadow-lg" />
          </div>
        </div>

        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create your account</h2>
          <p class="text-gray-600 dark:text-gray-400">
            Start organizing your thoughts in seconds
          </p>
        </div>

        <UCard class="shadow-2xl border-0 dark:bg-gray-800">
          <form @submit.prevent="handleSignup" class="space-y-5">
            <div>
              <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Full Name <span class="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <UInput
                v-model="form.name"
                type="text"
                placeholder="John Doe"
                size="xl"
                :disabled="loading"
                class="w-full"
                icon="i-heroicons-user"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Email Address *
              </label>
              <UInput
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                size="xl"
                :disabled="loading"
                class="w-full"
                icon="i-heroicons-envelope"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Password *
              </label>
              <UInput
                v-model="form.password"
                type="password"
                placeholder="Minimum 6 characters"
                size="xl"
                :disabled="loading"
                class="w-full"
                icon="i-heroicons-lock-closed"
              />
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Must be at least 6 characters long
              </p>
            </div>

            <UButton
              type="submit"
              size="xl"
              :loading="loading"
              :disabled="loading"
              class="w-full justify-center font-semibold"
              color="primary"
            >
              <span v-if="!loading">Create Account</span>
              <span v-else>Creating account...</span>
            </UButton>

            <p class="text-xs text-center text-gray-500 dark:text-gray-400 pt-2">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </UCard>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?
            <NuxtLink to="/login" class="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 ml-1 transition-colors">
              Sign in →
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>

