// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },  // Vue DevTools for debugging
  
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
    autoClear: 1500 // Duration in milliseconds (1.5 seconds)
  } as any,

  typescript: {
    strict: true,
    typeCheck: false  // VS Code/Cursor handles type checking via Volar extension
  },
  
  vite: {
    clearScreen: false,
    optimizeDeps: {
      include: ['notivue', '@tiptap/vue-3', '@tiptap/starter-kit']
    },
    server: {
      watch: {
        // Reduce file watching overhead
        usePolling: false,
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
      }
    }
  },

  css: [
    '~/assets/css/main.css',
    'notivue/notification.css',
    'notivue/animations.css'
  ],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Unfold Notes',
      short_name: 'Unfold Notes',
      description: 'Unfold your thinking - Modern markdown notes app',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/dashboard',
      icons: [
        {
          src: '/swan-unfold-white.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/swan-unfold-white.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/swan-unfold-white.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        },
        // Fallback to original if white version doesn't exist
        {
          src: '/swan-unfold.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/swan-unfold.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        }
      ]
    },
    workbox: {
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,png,svg,ico,woff,woff2}'],
      globIgnores: ['**/node_modules/**/*', '**/index.html'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
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
      enabled: false,  // Disable PWA in dev for better performance - test in preview mode
      type: 'module',
      suppressWarnings: true
    },
    injectRegister: process.env.NODE_ENV === 'production' ? 'auto' : null  // Disable service worker registration in dev
    // Note: PWA disabled in dev for performance. Test with: npm run build && npm run preview
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
    brevoApiKey: process.env.BREVO_API_KEY || '',
    minioEndpoint: process.env.MINIO_ENDPOINT || '',
    minioAccessKey: process.env.MINIO_ACCESS_KEY || '',
    minioSecretKey: process.env.MINIO_SECRET_KEY || '',
    minioBucket: process.env.MINIO_BUCKET || '',
    minioUseSSL: process.env.MINIO_USE_SSL !== 'false',
    
    // Public keys exposed to client (non-sensitive only)
    public: {
      apiBase: '/api',
      yjsWebsocketUrl: process.env.NUXT_PUBLIC_YJS_URL || ''
    }
  }
})
