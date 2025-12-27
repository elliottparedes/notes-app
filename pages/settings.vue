<script setup lang="ts">
import AnalyticsDashboard from '~/components/AnalyticsDashboard.vue';

const authStore = useAuthStore();
const toast = useToast();
const router = useRouter();

// Profile state
const profileName = ref(authStore.user?.name || '');
const profilePictureInput = ref<HTMLInputElement | null>(null);
const uploadingProfilePicture = ref(false);

// Dark mode toggle
const colorMode = useColorMode();

const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const showTempPasswordAlert = computed(() => authStore.needsPasswordReset);

const isLoggingOut = ref(false);

async function handleUpdateProfile() {
  if (!profileName.value.trim()) {
    toast.add({
      title: 'Error',
      description: 'Name is required',
      color: 'error'
    });
    return;
  }

  loading.value = true;
  try {
    await authStore.updateProfile({ name: profileName.value.trim() });
    toast.add({
      title: 'Success',
      description: 'Profile updated successfully!',
      color: 'success'
    });
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update profile',
      color: 'error'
    });
  } finally {
    loading.value = false;
  }
}

async function handleProfilePictureUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  if (!file.type.startsWith('image/')) {
    toast.add({
      title: 'Error',
      description: 'Please upload an image file',
      color: 'error'
    });
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  uploadingProfilePicture.value = true;
  try {
    const updatedUser = await $fetch<any>('/api/user/profile-picture', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      },
      body: formData
    });

    authStore.user = updatedUser;
    if (process.client) {
      localStorage.setItem('cached_user', JSON.stringify(updatedUser));
    }

    toast.add({
      title: 'Success',
      description: 'Profile picture updated!',
      color: 'success'
    });
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to upload profile picture',
      color: 'error'
    });
  } finally {
    uploadingProfilePicture.value = false;
    if (profilePictureInput.value) profilePictureInput.value.value = '';
  }
}

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
  router.back();
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="max-w-6xl mx-auto px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-6">
        <button
          class="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4 transition-colors text-sm"
          @click="goBack"
        >
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage your account settings</p>
      </div>

      <!-- Temporary Password Alert -->
      <div v-if="showTempPasswordAlert" class="mb-6 border border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 p-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-blue-900 dark:text-blue-200 mb-1">
              ⚠️ Password Reset Required
            </h3>
            <p class="text-sm text-blue-800 dark:text-blue-300">
              You logged in with a temporary password. For security, please set a new permanent password using the form below.
            </p>
          </div>
        </div>
      </div>

      <!-- Account Info -->
      <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
        <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Profile Settings</h2>
        </div>
        <div class="p-4 space-y-6">
          <!-- Profile Picture -->
          <div class="flex flex-col sm:flex-row items-center gap-6">
                          <div class="relative">
                            <div class="w-24 h-24 bg-gray-100 dark:bg-gray-700 overflow-hidden border border-gray-300 dark:border-gray-600 rounded-full">
                              <img 
                                v-if="authStore.user?.profile_picture_url" 
                                :src="authStore.user.profile_picture_url" 
                                class="w-full h-full object-cover"
                              />
                              <div v-else class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                <UIcon name="i-heroicons-user" class="w-12 h-12" />
                              </div>
                            </div>
                            <button
                              @click="profilePictureInput?.click()"
                              class="absolute -bottom-2 -right-2 p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-full"
                              title="Change profile picture"
                            >
                              <UIcon name="i-heroicons-camera" class="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </button>
                            <input
                              ref="profilePictureInput"
                              type="file"
                              class="hidden"
                              accept="image/*"
                              @change="handleProfilePictureUpload"
                            />
                          </div>            <div class="flex-1 text-center sm:text-left">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">Profile Picture</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">JPG, GIF or PNG. Max size of 10MB.</p>
              <div class="flex justify-center sm:justify-start">
                <button
                  @click="profilePictureInput?.click()"
                  :disabled="uploadingProfilePicture"
                  class="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <UIcon v-if="uploadingProfilePicture" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
                  <span>{{ uploadingProfilePicture ? 'Uploading...' : 'Upload New Picture' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Name and Email -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
                Full Name
              </label>
              <UInput
                v-model="profileName"
                placeholder="Your name"
                size="md"
                :disabled="loading"
                class="w-full"
                :ui="{ rounded: 'rounded-none' }"
              />
            </div>
            <div>
              <label class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>
              <UInput
                :value="authStore.user?.email"
                disabled
                size="md"
                class="w-full"
                icon="i-heroicons-envelope"
                :ui="{ rounded: 'rounded-none' }"
              />
              <p class="mt-1 text-[10px] text-gray-500">Email cannot be changed</p>
            </div>
          </div>

          <div class="flex justify-end">
            <button
              @click="handleUpdateProfile"
              :disabled="loading"
              class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <UIcon 
                v-if="loading" 
                name="i-heroicons-arrow-path" 
                class="w-4 h-4 animate-spin" 
              />
              <span>Save Profile</span>
            </button>
          </div>
        </div>
      </div>

<!-- Analytics Dashboard -->
      <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
          <div class="flex items-center justify-between w-full">
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">Analytics</h2>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Track your writing activity and productivity
              </p>
            </div>
          </div>
        </div>
        <div class="p-4">
          <AnalyticsDashboard />
        </div>
      </div>

      <!-- Appearance Settings -->
      <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </div>
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between py-2">
            <div class="flex-1">
              <label class="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                Dark Mode
              </label>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Switch between light and dark theme
              </p>
            </div>
            <!-- Custom Toggle Switch -->
            <button
              @click="isDark = !isDark"
              type="button"
              role="switch"
              :aria-checked="isDark"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-500 ml-4"
              :class="isDark ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform bg-white transition duration-200 ease-in-out"
                :class="isDark ? 'translate-x-5' : 'translate-x-0'"
              >
                <span class="absolute inset-0 flex items-center justify-center">
                  <UIcon 
                    :name="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'" 
                    class="h-3.5 w-3.5"
                    :class="isDark ? 'text-blue-600' : 'text-gray-400'"
                  />
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Change Password -->
      <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ showTempPasswordAlert ? 'Set New Password' : 'Change Password' }}
            </h2>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {{ showTempPasswordAlert 
                ? 'Set a permanent password to secure your account' 
                : 'Update your password to keep your account secure' 
              }}
            </p>
          </div>
        </div>
        <form @submit.prevent="handleChangePassword" class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-normal mb-1.5 text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="Enter new password (min 6 characters)"
              size="md"
              :disabled="loading"
              class="w-full"
              icon="i-heroicons-lock-closed"
              :ui="{ rounded: 'rounded-none' }"
            />
          </div>

          <div>
            <label class="block text-sm font-normal mb-1.5 text-gray-700 dark:text-gray-300">
              Confirm New Password
            </label>
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm your new password"
              size="md"
              :disabled="loading"
              class="w-full"
              icon="i-heroicons-lock-closed"
              :ui="{ rounded: 'rounded-none' }"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-normal border border-blue-700 dark:border-blue-600 hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 dark:active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <UIcon 
              v-if="loading" 
              name="i-heroicons-arrow-path" 
              class="w-4 h-4 animate-spin" 
            />
            <span>{{ loading ? (showTempPasswordAlert ? 'Setting Password...' : 'Changing Password...') : (showTempPasswordAlert ? 'Set New Password' : 'Change Password') }}</span>
          </button>
        </form>
      </div>

      <!-- Account Actions -->
      <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Account Actions</h2>
        </div>
        <div class="p-4">
          <button
            @click="handleLogout"
            :disabled="isLoggingOut"
            class="w-full px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 text-sm font-normal border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <UIcon 
              v-if="isLoggingOut" 
              name="i-heroicons-arrow-path" 
              class="w-4 h-4 animate-spin" 
            />
            <UIcon 
              v-else
              name="i-heroicons-arrow-right-on-rectangle" 
              class="w-4 h-4" 
            />
            <span>{{ isLoggingOut ? 'Signing Out...' : 'Sign Out' }}</span>
          </button>
        </div>
      </div>

      <!-- Support Unfold Notes -->
      <div class="mb-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div class="px-4 py-3 border-b border-gray-300 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Support Unfold Notes</h2>
        </div>
        <div class="p-4 space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Unfold Notes is built and maintained by a small indie developer. Server costs, AI API calls, and infrastructure add up. 
            If you find Unfold Notes useful, consider buying me a coffee to help keep it running! ☕️
          </p>
          
          <div class="flex items-center justify-center pt-2">
            <BuyMeACoffee variant="button" size="lg" />
          </div>

          <div class="pt-4 border-t border-gray-300 dark:border-gray-700 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Made with ❤️ by Elliott
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

