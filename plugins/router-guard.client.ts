export default defineNuxtPlugin(() => {
  const router = useRouter();

  // Suppress Vue Router and hydration warnings
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0];
    
    // Suppress warnings about API routes not being found
    if (typeof message === 'string' && 
        message.includes('No match found for location with path "/api/')) {
      return;
    }
    
    // Suppress hydration mismatch warnings (expected during client-side initialization)
    if (typeof message === 'string' && 
        (message.includes('Hydration') || message.includes('hydration'))) {
      return;
    }
    
    // Suppress tiptap duplicate extension warnings (known issue)
    if (typeof message === 'string' && 
        message.includes('Duplicate extension names')) {
      return;
    }
    
    originalWarn.apply(console, args);
  };

  // Add navigation guard to prevent API routes from being treated as page routes
  router.beforeEach((to) => {
    // If trying to navigate to an API route, abort the navigation silently
    if (to.path.startsWith('/api/')) {
      return false;
    }
  });
});

