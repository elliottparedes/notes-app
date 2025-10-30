import { defineStore } from 'pinia';
import type { User, UserSignupDto, UserLoginDto, AuthResponse } from '~/models';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  initPromise: Promise<void> | null;
  needsPasswordReset: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    loading: false,
    error: null,
    initialized: false,
    initPromise: null,
    needsPasswordReset: false
  }),

  getters: {
    isAuthenticated: (state): boolean => {
      return !!state.user && !!state.token;
    },
    currentUser: (state): User | null => state.user
  },

  actions: {
    async signup(data: UserSignupDto): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const response = await $fetch<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          body: data
        });

        this.user = response.user;
        this.token = response.token;
        this.initialized = true;
        
        // Store token in localStorage with session version
        if (process.client) {
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('session_version', Date.now().toString());
        }
        
        // Navigate to dashboard
        await navigateTo('/dashboard');
      } catch (err: unknown) {
        // Extract error message from $fetch error response
        let errorMessage = 'Signup failed';
        
        if (err && typeof err === 'object') {
          // Check for Nuxt error structure (err.data.message)
          if ('data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
            errorMessage = String(err.data.message);
          }
          // Fallback to err.message for standard errors
          else if ('message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          }
        }
        
        this.error = errorMessage;
        
        // Create a new error with the extracted message to throw
        const error = new Error(errorMessage);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async login(data: UserLoginDto): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const response = await $fetch<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: data
        });

        this.user = response.user;
        this.token = response.token;
        this.initialized = true;
        this.needsPasswordReset = response.usedTemporaryPassword || false;
        
        // Store token and password reset flag in localStorage with session version
        if (process.client) {
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('session_version', Date.now().toString());
          if (response.usedTemporaryPassword) {
            localStorage.setItem('needs_password_reset', 'true');
          }
        }
        
        // If logged in with temporary password, redirect to settings
        if (response.usedTemporaryPassword) {
          await navigateTo('/settings');
        } else {
          // Navigate to dashboard
          await navigateTo('/dashboard');
        }
      } catch (err: unknown) {
        // Extract error message from $fetch error response
        let errorMessage = 'Login failed';
        
        if (err && typeof err === 'object') {
          // Check for Nuxt error structure (err.data.message)
          if ('data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
            errorMessage = String(err.data.message);
          }
          // Fallback to err.message for standard errors
          else if ('message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          }
        }
        
        this.error = errorMessage;
        
        // Create a new error with the extracted message to throw
        const error = new Error(errorMessage);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async logout(): Promise<void> {
      this.user = null;
      this.token = null;
      this.initialized = false;
      this.needsPasswordReset = false;
      
      if (process.client) {
        localStorage.clear();
        sessionStorage.clear();
        
        // Add timestamp to force fresh state on next login
        localStorage.setItem('last_logout', Date.now().toString());
        
        // Wait for storage to be cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force page reload to clear all state
        window.location.replace('/login');
      } else {
        await navigateTo('/login');
      }
    },

    async fetchCurrentUser(): Promise<void> {
      if (!this.token && process.client) {
        this.token = localStorage.getItem('auth_token');
      }

      if (!this.token) {
        this.initialized = true;
        return;
      }

      this.loading = true;

      try {
        const response = await $fetch<User>('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        });

        this.user = response;
      } catch (err: unknown) {
        console.error('Failed to fetch current user:', err);
        
        // Clear invalid token
        this.user = null;
        this.token = null;
        
        if (process.client) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('session_version');
        }
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async initializeAuth(): Promise<void> {
      // Return existing promise if already initializing
      if (this.initPromise) {
        return this.initPromise;
      }

      // Create initialization promise
      this.initPromise = (async () => {
        if (process.client) {
          const token = localStorage.getItem('auth_token');
          const needsReset = localStorage.getItem('needs_password_reset');
          
          if (token) {
            this.token = token;
            this.needsPasswordReset = needsReset === 'true';
            await this.fetchCurrentUser();
          } else {
            this.initialized = true;
          }
        }
      })();

      await this.initPromise;
      this.initPromise = null;
    },

    clearPasswordResetFlag(): void {
      this.needsPasswordReset = false;
      if (process.client) {
        localStorage.removeItem('needs_password_reset');
      }
    }
  }
});

