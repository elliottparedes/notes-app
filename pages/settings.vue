<script setup lang="ts">
const authStore = useAuthStore();
const toast = useToast();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const emergencyNewPassword = ref('');
const emergencyConfirmPassword = ref('');
const emergencyLoading = ref(false);

const showTempPasswordAlert = computed(() => authStore.needsPasswordReset);

async function handleChangePassword() {
  // Validation
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
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
      description: 'New passwords do not match',
      color: 'error'
    });
    return;
  }

  if (currentPassword.value === newPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'New password must be different from current password',
      color: 'error'
    });
    return;
  }

  loading.value = true;

  try {
    await $fetch('/api/user/change-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      }
    });

    toast.add({
      title: 'Success',
      description: 'Password changed successfully!',
      color: 'success'
    });

    // Clear form
    currentPassword.value = '';
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

async function handleEmergencyReset() {
  // Validation
  if (!emergencyNewPassword.value || !emergencyConfirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'All fields are required',
      color: 'error'
    });
    return;
  }

  if (emergencyNewPassword.value.length < 6) {
    toast.add({
      title: 'Validation Error',
      description: 'New password must be at least 6 characters',
      color: 'error'
    });
    return;
  }

  if (emergencyNewPassword.value !== emergencyConfirmPassword.value) {
    toast.add({
      title: 'Validation Error',
      description: 'Passwords do not match',
      color: 'error'
    });
    return;
  }

  emergencyLoading.value = true;

  try {
    await $fetch('/api/user/force-reset-password', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: {
        newPassword: emergencyNewPassword.value
      }
    });

    // Clear the password reset flag
    authStore.clearPasswordResetFlag();

    toast.add({
      title: 'Success',
      description: 'Password reset successfully!',
      color: 'success'
    });

    // Clear form
    emergencyNewPassword.value = '';
    emergencyConfirmPassword.value = '';
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to reset password',
      color: 'error'
    });
  } finally {
    emergencyLoading.value = false;
  }
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
            <p class="text-sm text-blue-800 dark:text-blue-300 mb-3">
              You logged in with a temporary password. For security, please set a new permanent password using the <strong>"Emergency Password Reset"</strong> section below.
            </p>
            <p class="text-sm text-blue-700 dark:text-blue-400">
              💡 <strong>Tip:</strong> Scroll down to the orange "Emergency Password Reset" section and enter your new password there. Don't use the "Change Password" section above it.
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

      <!-- Change Password -->
      <UCard>
        <template #header>
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Change Password</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Update your password to keep your account secure
            </p>
          </div>
        </template>

        <form @submit.prevent="handleChangePassword" class="space-y-5">
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Current Password
            </label>
            <UInput
              v-model="currentPassword"
              type="password"
              placeholder="Enter your current password"
              size="xl"
              :disabled="loading"
              class="w-full"
              icon="i-heroicons-lock-closed"
            />
          </div>

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
            color="primary"
          >
            <span v-if="!loading">Change Password</span>
            <span v-else>Changing Password...</span>
          </UButton>
        </form>
      </UCard>

      <!-- Emergency Password Reset (if forgot current password) -->
      <UCard 
        class="mt-6 border-2"
        :class="showTempPasswordAlert ? 'border-blue-500 dark:border-blue-600 shadow-lg shadow-blue-500/50' : 'border-orange-200 dark:border-orange-800'"
      >
        <template #header>
          <div>
            <h2 class="text-xl font-semibold" :class="showTempPasswordAlert ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'">
              {{ showTempPasswordAlert ? '🔐 Set Your New Password' : 'Emergency Password Reset' }}
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ showTempPasswordAlert 
                ? 'Set a permanent password to secure your account' 
                : 'Can\'t remember your current password? Use this to reset without it.' 
              }}
            </p>
          </div>
        </template>

        <form @submit.prevent="handleEmergencyReset" class="space-y-5">
          <div 
            v-if="!showTempPasswordAlert"
            class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
          >
            <p class="text-sm text-orange-800 dark:text-orange-300">
              ⚠️ <strong>Note:</strong> This will reset your password without requiring your current password. Only use this if you're locked out.
            </p>
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <UInput
              v-model="emergencyNewPassword"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              size="xl"
              :disabled="emergencyLoading"
              class="w-full"
              icon="i-heroicons-lock-closed"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <UInput
              v-model="emergencyConfirmPassword"
              type="password"
              placeholder="Confirm your new password"
              size="xl"
              :disabled="emergencyLoading"
              class="w-full"
              icon="i-heroicons-lock-closed"
            />
          </div>

          <UButton
            type="submit"
            size="xl"
            :loading="emergencyLoading"
            :disabled="emergencyLoading"
            class="justify-center font-semibold"
            color="warning"
          >
            <span v-if="!emergencyLoading">Reset Password Now</span>
            <span v-else>Resetting Password...</span>
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>

