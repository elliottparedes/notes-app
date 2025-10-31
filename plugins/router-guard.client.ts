export default defineNuxtPlugin({
  name: 'router-guard',
  enforce: 'pre', // Run this plugin early
  setup() {
    const router = useRouter();

    // Suppress Vue Router and hydration warnings
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      // Convert all args to string for pattern matching
      const messageStr = args.map(arg => String(arg)).join(' ');
      
      // Suppress warnings about API routes not being found
      if (messageStr.includes('No match found for location with path') && 
          messageStr.includes('/api/')) {
        return;
      }
      
      // Suppress warnings about service worker files not being found (catch all formats)
      if (messageStr.includes('/dev-sw.js') || messageStr.includes('/sw.js')) {
        // Check if it's a router warning
        if (messageStr.includes('No match found') || 
            messageStr.includes('[Vue Router warn]') || 
            messageStr.includes('Vue Router warn') ||
            messageStr.includes('router')) {
          return;
        }
      }
      
      // Suppress hydration mismatch warnings (expected during client-side initialization)
      if (messageStr.includes('Hydration') || messageStr.includes('hydration')) {
        return;
      }
      
      // Suppress tiptap duplicate extension warnings (known issue)
      if (messageStr.includes('Duplicate extension names')) {
        return;
      }
      
      originalWarn.apply(console, args);
    };

    // Add navigation guard to prevent API routes and service worker files from being treated as page routes
    router.beforeEach((to) => {
      // If trying to navigate to an API route, abort the navigation silently
      if (to.path.startsWith('/api/')) {
        return false;
      }
      
      // If trying to navigate to service worker files, abort the navigation silently
      if (to.path.startsWith('/dev-sw.js') || to.path.startsWith('/sw.js')) {
        return false;
      }
    });
  }
});

