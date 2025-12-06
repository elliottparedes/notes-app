<script setup lang="ts">
import AnalyticsDashboard from '~/components/AnalyticsDashboard.vue';

const authStore = useAuthStore();
const toast = useToast();

// Dark mode toggle
const colorMode = useColorMode();

const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const showTempPasswordAlert = computed(() => authStore.needsPasswordReset);

const isLoggingOut = ref(false);

async function handleLogout() {
  isLoggingOut.value = true;
  try {
    await authStore.logout();
  } catch (error) {
    console.error('Error logging out:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to log out',
      color: 'error'
    });
    isLoggingOut.value = false;
  }
}

// Computed for dark mode toggle state
const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (value: boolean) => {
    colorMode.preference = value ? 'dark' : 'light';
  }
});

async function handleChangePassword() {
  // Validation
  if (!newPassword.value || !confirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'All fields are required',
      color: 'error'
    });
    return;
  }

  if (newPassword.value.length < 6) {
    toast.add({
      title: 'Validation Error',
      description: 'New password must be at least 6 characters',
      color: 'error'
    });
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'Passwords do not match',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    await $fetch('/api/user/force-reset-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        newPassword: newPassword.value
      }
    });

    // Clear the password reset flag
    authStore.clearPasswordResetFlag();

    toast.add({
      title: 'Success',
      description: 'Password changed successfully!',
      color: 'success'
    });

    // Clear form
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to change password',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

function goBack() {
  navigateTo('/dashboard');
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <button
          @click="goBack"
          class="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </button>
        
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Manage your account settings</p>
      </div>

      <!-- Temporary Password Alert -->
      <UCard v-if="showTempPasswordAlert" class="mb-6 border-2 border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
              ⚠️ Password Reset Required
            </h3>
            <p class="text-sm text-blue-800 dark:text-blue-300">
              You logged in with a temporary password. For security, please set a new permanent password using the form below.
            </p>
          </div>
        </div>
      </UCard>

      <!-- Account Info -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Account Information</h2>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <p class="text-gray-900 dark:text-white">{{ authStore.user?.email }}</p>
          </div>
          
          <div v-if="authStore.user?.name">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <p class="text-gray-900 dark:text-white">{{ authStore.user?.name }}</p>
          </div>
        </div>
      </UCard>

<!-- Analytics Dashboard -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Analytics</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Track your writing activity and productivity
              </p>
            </div>
          </div>
        </template>

        <AnalyticsDashboard />
      </UCard>

      <!-- Appearance Settings -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </template>

        <div class="space-y-4">
          <div class="flex items-center justify-between py-2">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dark Mode
              </label>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Switch between light and dark theme
              </p>
            </div>
            <!-- Custom Toggle Switch -->
            <button
              @click="isDark = !isDark"
              type="button"
              role="switch"
              :aria-checked="isDark"
              class="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ml-4"
              :class="isDark ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span
                class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="isDark ? 'translate-x-5' : 'translate-x-0'"
              >
                <span class="absolute inset-0 flex items-center justify-center">
                  <UIcon 
                    :name="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'" 
                    class="h-4 w-4"
                    :class="isDark ? 'text-primary-600' : 'text-gray-400'"
                  />
                </span>
              </span>
            </button>
          </div>
        </div>
      </UCard>

      <!-- Change Password -->
      <UCard>
        <template #header>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ showTempPasswordAlert ? 'Set New Password' : 'Change Password' }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ showTempPasswordAlert 
                ? 'Set a permanent password to secure your account' 
                : 'Update your password to keep your account secure' 
              }}
            </p>
          </div>
        </template>

        <form @submit.prevent="handleChangePassword" class="space-y-5">
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              size="xl"
              :disabled="loading"
              class="w-full"
              icon="i-heroicons-lock-closed"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your new password"
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
            class="justify-center font-semibold"
            :color="showTempPasswordAlert ? 'warning' : 'primary'"
          >
            <span v-if="!loading">{{ showTempPasswordAlert ? 'Set New Password' : 'Change Password' }}</span>
            <span v-else>{{ showTempPasswordAlert ? 'Setting Password...' : 'Changing Password...' }}</span>
          </UButton>
        </form>
      </UCard>

      <!-- Account Actions -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Account Actions</h2>
        </template>

        <div class="space-y-4">
          <UButton
            color="error"
            variant="soft"
            icon="i-heroicons-arrow-right-on-rectangle"
            size="xl"
            :loading="isLoggingOut"
            :disabled="isLoggingOut"
            block
            @click="handleLogout"
            class="justify-center font-semibold"
          >
            <span v-if="!isLoggingOut">Sign Out</span>
            <span v-else>Signing Out...</span>
          </UButton>
        </div>
      </UCard>

      <!-- Support Unfold Notes -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Support Unfold Notes</h2>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Unfold Notes is built and maintained by a small indie developer. Server costs, AI API calls, and infrastructure add up. 
            If you find Unfold Notes useful, consider buying me a coffee to help keep it running! ☕️
          </p>
          
          <div class="flex items-center justify-center pt-2">
            <BuyMeACoffee variant="button" size="lg" />
          </div>

          <div class="pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Made with ❤️ by Elliott
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

