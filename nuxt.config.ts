// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
    'notivue/nuxt'
  ],

  hooks: {
    // Override @nuxt/ui's useToast with our custom one
    'imports:extend': (imports) => {
      // Remove @nuxt/ui's useToast
      const index = imports.findIndex(i => i.name === 'useToast' && i.from.includes('@nuxt/ui'))
      if (index !== -1) {
        imports.splice(index, 1)
      }
    }
  },

  notivue: {
    position: 'top-right',
    limit: 5,
    enqueue: true,
    avoidDuplicates: true,
    pauseOnHover: false, // Disable pause on hover
    pauseOnTouch: false, // Disable pause on touch
    autoClear: 3000 // Duration in milliseconds
  } as any,

  typescript: {
    strict: true,
    typeCheck: true
  },

  css: [
    '~/assets/css/main.css',
    'notivue/notification.css',
    'notivue/animations.css'
  ],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Markdown Notes',
      short_name: 'Notes',
      description: 'Offline-first markdown notes app',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/dashboard',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,png,svg,ico,woff,woff2}'],
      globIgnores: ['**/node_modules/**/*', '**/index.html'],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /\/_nuxt\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'nuxt-assets',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 7
            },
            networkTimeoutSeconds: 3,
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    devOptions: {
      enabled: true,  // Enable in development for testing
      type: 'module',
      suppressWarnings: true
    }
  },

  runtimeConfig: {
    // Private keys only available server-side at runtime
    // Nitro loads these at runtime from environment variables, not at build time
    dbHost: process.env.DB_HOST || '',
    dbPort: process.env.DB_PORT || '3306',
    dbUser: process.env.DB_USER || '',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || '',
    jwtSecret: process.env.JWT_SECRET || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    
    // Public keys exposed to client (non-sensitive only)
    public: {
      apiBase: '/api'
    }
  }
})
