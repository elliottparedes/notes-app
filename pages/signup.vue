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
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold">Create Account</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-2">Get started with markdown notes</p>
        </div>
      </template>

      <form @submit.prevent="handleSignup" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Name <span class="text-gray-400">(Optional)</span></label>
          <UInput
            v-model="form.name"
            type="text"
            placeholder="John Doe"
            size="lg"
            :disabled="loading"
          />
        </div>

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
          <label class="block text-sm font-medium mb-1">Password * <span class="text-sm text-gray-400">(Minimum 6 characters)</span></label>
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
          Create Account
        </UButton>
      </form>

      <template #footer>
        <div class="text-center text-sm">
          <span class="text-gray-600 dark:text-gray-400">Already have an account? </span>
          <NuxtLink to="/login" class="text-primary font-semibold hover:underline">
            Sign in
          </NuxtLink>
        </div>
      </template>
    </UCard>
  </div>
</template>

