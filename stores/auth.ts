import { defineStore } from 'pinia';
import type { User, UserSignupDto, UserLoginDto, AuthResponse } from '~/models';
import { clearNotesCache } from '~/utils/notesCache';
import { clearProfilePictureCache } from '~/utils/profilePictureCache';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  initPromise: Promise<void> | null;
  needsPasswordReset: boolean;
  showDeveloperUI: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: useCookie<string | null>('auth_token').value || null,
    loading: false,
    error: null,
    initialized: false,
    initPromise: null,
    needsPasswordReset: false,
    showDeveloperUI: process.client ? localStorage.getItem('show_developer_ui') === 'true' : false
  }),

  getters: {
    isAuthenticated: (state): boolean => {
      // Allow authentication if we have a token, even without user data (offline mode)
      // This enables access to locally cached notes when server is down
      return !!state.token;
    },
    currentUser: (state): User | null => state.user,
    isDeveloperUIEnabled: (state): boolean => state.showDeveloperUI
  },

  actions: {
    toggleDeveloperUI() {
      this.showDeveloperUI = !this.showDeveloperUI;
      if (process.client) {
        localStorage.setItem('show_developer_ui', String(this.showDeveloperUI));
      }
    },
    
    async signup(data: UserSignupDto): Promise<void> {
      this.loading = true;
      this.error = null;

      try {
        const response = await $fetch<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          body: data
        });

        const tokenCookie = useCookie('auth_token', { maxAge: 60 * 60 * 24 * 30 }); // 30 days
        tokenCookie.value = response.token;
        
        this.user = response.user;
        this.token = response.token;
        this.initialized = true;
        
        // Store user in localStorage for offline access
        if (process.client) {
          localStorage.setItem('session_version', Date.now().toString());
          localStorage.setItem('cached_user', JSON.stringify(response.user));
        }
        
        // Navigate to dashboard
        await navigateTo('/notes');
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

        const tokenCookie = useCookie('auth_token', { maxAge: 60 * 60 * 24 * 30 }); // 30 days
        tokenCookie.value = response.token;

        this.user = response.user;
        this.token = response.token;
        this.initialized = true;
        this.needsPasswordReset = response.usedTemporaryPassword || false;
        
        // Store user and password reset flag in localStorage for offline access
        if (process.client) {
          localStorage.setItem('session_version', Date.now().toString());
          localStorage.setItem('cached_user', JSON.stringify(response.user));
          if (response.usedTemporaryPassword) {
            localStorage.setItem('needs_password_reset', 'true');
          }
        }
        
        // If logged in with temporary password, redirect to settings
        if (response.usedTemporaryPassword) {
          await navigateTo('/settings');
        } else {
          // Navigate to dashboard
          await navigateTo('/notes');
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
      const tokenCookie = useCookie('auth_token');
      tokenCookie.value = null;
      
      this.user = null;
      this.token = null;
      this.initialized = false;
      this.needsPasswordReset = false;
      
      if (process.client) {
        // Clear notes cache
        await clearNotesCache();

        // Clear profile picture cache
        await clearProfilePictureCache();

        // Clear folder caches
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('folders_cache_')) {
            localStorage.removeItem(key);
          }
        });

        // Clear auth-related items
        localStorage.removeItem('session_version');
        localStorage.removeItem('cached_user');
        localStorage.removeItem('needs_password_reset');
        // Legacy cleanup
        localStorage.removeItem('auth_token'); 
        
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
      // Token is initialized in state from cookie
      if (!this.token) {
        this.initialized = true;
        return;
      }

      // Try to load cached user first for offline access
      if (process.client && !this.user) {
        const cachedUser = localStorage.getItem('cached_user');
        if (cachedUser) {
          try {
            this.user = JSON.parse(cachedUser);
          } catch (e) {
            console.error('Failed to parse cached user:', e);
          }
        }
      }

      this.loading = true;

      try {
        // Add timeout to prevent hanging in production
        const response = await Promise.race([
          $fetch<User>('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${this.token}`
            }
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 3000)
          )
        ]);

        this.user = response;
        
        // Update cached user
        if (process.client) {
          localStorage.setItem('cached_user', JSON.stringify(response));
        }
      } catch (err: unknown) {
        console.error('Failed to fetch current user:', err);
        
        // Check if it's an authentication error (401/403) vs network/server error
        const isAuthError = err && typeof err === 'object' && 'statusCode' in err 
          && (err.statusCode === 401 || err.statusCode === 403);
        
        if (isAuthError) {
          // Only clear token on actual auth errors (invalid token)
          this.user = null;
          this.token = null;
          const tokenCookie = useCookie('auth_token');
          tokenCookie.value = null;
          
          if (process.client) {
            localStorage.removeItem('session_version');
            localStorage.removeItem('cached_user');
            localStorage.removeItem('auth_token');
          }
        } else {
          // Network/server error - keep token and cached user for offline access
          // User can still access their local notes
          console.warn('Server unavailable, using cached user data for offline access');
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
        // Token is already in state from cookie (handled by Nuxt useCookie in state)
        
        if (process.client) {
          const needsReset = localStorage.getItem('needs_password_reset');
          const cachedUser = localStorage.getItem('cached_user');
          
          if (this.token) {
            this.needsPasswordReset = needsReset === 'true';
            
            // Load cached user immediately for instant offline access
            if (cachedUser && !this.user) {
              try {
                this.user = JSON.parse(cachedUser);
              } catch (e) {
                console.error('Failed to parse cached user:', e);
              }
            }
            
            // Try to fetch fresh user data (will fallback to cached on server error)
            // Add timeout to prevent hanging in production
            try {
              await Promise.race([
                this.fetchCurrentUser(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Auth initialization timeout')), 5000)
                )
              ]);
            } catch (error) {
              // If timeout or other error, mark as initialized anyway with cached data
              console.warn('Auth initialization timeout or error, using cached data:', error);
              this.initialized = true;
            }
          } else {
            // No token - mark as initialized immediately
            this.initialized = true;
          }
        } else {
          // Server side - mark as initialized
          // If we have a token (from cookie), we might want to fetch user? 
          // For now, assume initialized to allow middleware to redirect based on token presence
          this.initialized = true;
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
    },

    async updateProfile(data: { name?: string, profile_picture_url?: string }): Promise<void> {
      if (!this.token) return;

      this.loading = true;
      this.error = null;

      try {
        const response = await $fetch<User>('/api/user/profile', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.token}`
          },
          body: data
        });

        this.user = response;
        
        // Update cached user
        if (process.client) {
          localStorage.setItem('cached_user', JSON.stringify(response));
        }
      } catch (err: unknown) {
        let errorMessage = 'Update failed';
        if (err && typeof err === 'object' && 'data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
          errorMessage = String(err.data.message);
        }
        this.error = errorMessage;
        throw err;
      } finally {
        this.loading = false;
      }
    }
  }
});

