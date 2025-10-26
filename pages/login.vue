<script setup lang="ts">
import type { UserLoginDto } from '~/models';

const authStore = useAuthStore();
const toast = useToast();

const form = reactive<UserLoginDto>({
  email: '',
  password: ''
});

const loading = ref(false);

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
    // Login will automatically navigate to dashboard on success
    await authStore.login(form);
    
    // Success toast is shown after navigation
    toast.add({
      title: 'Success',
      description: 'Logged in successfully!',
      color: 'success'
    });
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
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold">Welcome Back</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-2">Sign in to your account</p>
        </div>
      </template>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Email *</label>
          <UInput
            v-model="form.email"
            type="email"
            placeholder="you@example.com"
            size="lg"
            :disabled="loading"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Password *</label>
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            size="lg"
            :disabled="loading"
          />
        </div>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="loading"
          :disabled="loading"
        >
          Sign In
        </UButton>
      </form>

      <template #footer>
        <div class="text-center text-sm">
          <span class="text-gray-600 dark:text-gray-400">Don't have an account? </span>
          <NuxtLink to="/signup" class="text-primary font-semibold hover:underline">
            Sign up
          </NuxtLink>
        </div>
      </template>
    </UCard>
  </div>
</template>

