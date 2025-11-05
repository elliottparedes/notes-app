<script setup lang="ts">
import type { UserLoginDto } from '~/models';

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

const form = reactive<UserLoginDto>({
  email: '',
  password: ''
});

const loading = ref(false);
const showForgotPasswordModal = ref(false);

// Check synchronously on client side to prevent flash
const checkingAuth = ref(true);

// Immediate synchronous check for token (runs before first render)
if (process.client) {
  const token = localStorage.getItem('auth_token');
  if (token) {
    // Token exists - redirect immediately, keep showing loading
    checkingAuth.value = true;
    // Use nextTick to ensure router is ready
    nextTick(() => {
      router.replace('/dashboard');
    });
  } else {
    // No token found, allow page to render immediately
    // This handles the case after logout where we want to show the login page right away
    checkingAuth.value = false;
  }
} else {
  // On server, always check (will be determined on client)
  checkingAuth.value = true;
}

// Also check after mount to handle async auth initialization
onMounted(async () => {
  // Quick check - if no token in localStorage, skip initialization and show page immediately
  if (process.client && !localStorage.getItem('auth_token')) {
    checkingAuth.value = false;
    // Ensure auth store is marked as initialized if no token
    if (!authStore.initialized) {
      authStore.initialized = true;
    }
    return;
  }

  // Wait for auth store to initialize if it hasn't already, but with timeout
  if (!authStore.initialized) {
    try {
      // Race the initialization with a timeout to prevent hanging
      await Promise.race([
        authStore.initializeAuth(),
        new Promise((resolve) => setTimeout(resolve, 3000))
      ]);
    } catch (error) {
      console.warn('Auth initialization error:', error);
      // Mark as initialized anyway to show login page
      authStore.initialized = true;
    }
  }
  
  // Check if user is already authenticated
  if (authStore.isAuthenticated) {
    // Redirect immediately without showing the login page
    await router.replace('/dashboard');
    return;
  }
  
  // Allow page to render if not authenticated
  checkingAuth.value = false;
});

function openForgotPassword() {
  showForgotPasswordModal.value = true;
}

async function handleLogin() {
  if (!form.email || !form.password) {
    toast.add({
      title: 'Validation Error',
      description: 'Please fill in all fields',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    // Login will automatically navigate to dashboard or settings on success
    await authStore.login(form);
    
    // Success toast is shown after navigation
    if (authStore.needsPasswordReset) {
      toast.add({
        title: 'Temporary Password Detected',
        description: 'Please set a new permanent password to secure your account',
        color: 'warning',
        timeout: 8000
      });
    } else {
      toast.add({
        title: 'Success',
        description: 'Logged in successfully!',
        color: 'success'
      });
    }
  } catch (error: unknown) {
    loading.value = false;
    toast.add({
      title: 'Login Failed',
      description: error instanceof Error ? error.message : 'Invalid credentials',
      color: 'error'
    });
  }
  // Don't set loading to false on success - let navigation happen
}
</script>

<template>
  <div>
    <!-- Show loading state while checking auth -->
    <div v-if="checkingAuth" class="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div class="text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary-600 mb-4" />
        <p class="text-sm text-gray-600 dark:text-gray-400">Checking authentication...</p>
      </div>
    </div>
    
    <!-- Show login form only when not checking auth -->
    <div v-else class="min-h-screen flex">
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
          Welcome Back to<br />Your Digital Workspace
        </h1>
        
        <p class="text-xl text-slate-300 mb-12 leading-relaxed">
          Continue where you left off. Your notes are waiting for you, synced and ready across all devices.
        </p>
        
        <div class="space-y-6">
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-500/20 backdrop-blur-sm flex items-center justify-center">
              <svg class="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-1">Instant Access</h3>
              <p class="text-slate-400 text-sm">Pick up right where you left off</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center">
              <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-1">Secure & Private</h3>
              <p class="text-slate-400 text-sm">Your notes are private and securely stored</p>
            </div>
          </div>
          
          <div class="flex items-start space-x-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-500/20 backdrop-blur-sm flex items-center justify-center">
              <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-lg mb-1">Cross-Device Sync</h3>
              <p class="text-slate-400 text-sm">Seamlessly synced everywhere you work</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Login Form -->
    <div class="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <div class="relative">
            <div class="absolute inset-0 bg-gradient-to-br from-primary-400 via-emerald-500 to-teal-600 rounded-3xl blur-xl opacity-30"></div>
            <img src="/swan-unfold.png" alt="Unfold Notes" class="relative w-20 h-20 drop-shadow-lg" />
          </div>
        </div>

        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome back</h2>
          <p class="text-gray-600 dark:text-gray-400">
            Sign in to access your notes
          </p>
        </div>

        <UCard class="shadow-2xl border-0 dark:bg-gray-800">
          <form @submit.prevent="handleLogin" class="space-y-5">
            <div>
              <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Email Address
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
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <button
                  type="button"
                  @click.stop.prevent="openForgotPassword"
                  class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors cursor-pointer relative z-10 hover:underline"
                  :disabled="loading"
                  tabindex="0"
                >
                  Forgot password?
                </button>
              </div>
              <UInput
                v-model="form.password"
                type="password"
                placeholder="Enter your password"
                size="xl"
                :disabled="loading"
                class="w-full"
                icon="i-heroicons-lock-closed"
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
              <span v-if="!loading">Sign In</span>
              <span v-else>Signing in...</span>
            </UButton>
          </form>
        </UCard>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?
            <NuxtLink to="/signup" class="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 ml-1 transition-colors">
              Sign up for free →
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
    </div>
    
    <!-- Forgot Password Modal -->
    <ForgotPasswordModal v-model="showForgotPasswordModal" />
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

