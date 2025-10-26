import { defineStore } from 'pinia';
import type { User, UserSignupDto, UserLoginDto, AuthResponse } from '~/models';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    loading: false,
    error: null
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
        
        // Store token in localStorage with session version
        if (process.client) {
          console.log('💾 Saving auth token and session version');
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('session_version', Date.now().toString());
        }

        console.log('✅ Signup successful, navigating to dashboard');
        
        // Navigate to dashboard
        await navigateTo('/dashboard');
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Signup failed';
        throw err;
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
        
        // Store token in localStorage with session version
        if (process.client) {
          console.log('💾 Saving auth token and session version');
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('session_version', Date.now().toString());
        }

        console.log('✅ Login successful, navigating to dashboard');
        
        // Navigate to dashboard
        await navigateTo('/dashboard');
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Login failed';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async logout(): Promise<void> {
      console.log('🚪 Logging out - clearing all state');
      
      this.user = null;
      this.token = null;
      
      // Clear ALL storage to prevent UI state issues
      if (process.client) {
        // Clear storage
        localStorage.clear();
        sessionStorage.clear();
        
        console.log('🧹 Cleared localStorage and sessionStorage');
        
        // Add a timestamp to force fresh state on next login
        localStorage.setItem('last_logout', Date.now().toString());
        
        // Wait a tiny bit to ensure storage is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('🔄 Forcing full page reload');
        
        // Force a full page reload to clear any cached state
        // Using replace to prevent back button issues
        window.location.replace('/login');
      } else {
        // Server-side fallback
        await navigateTo('/login');
      }
    },

    async fetchCurrentUser(): Promise<void> {
      if (!this.token && process.client) {
        this.token = localStorage.getItem('auth_token');
      }

      if (!this.token) {
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
        this.logout();
      } finally {
        this.loading = false;
      }
    },

    initializeAuth(): void {
      if (process.client) {
        const token = localStorage.getItem('auth_token');
        if (token) {
          this.token = token;
          this.fetchCurrentUser();
        }
      }
    }
  }
});

