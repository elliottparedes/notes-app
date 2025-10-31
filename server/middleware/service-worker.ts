// Server middleware to handle service worker requests and prevent router warnings
export default defineEventHandler((event) => {
  const url = event.node.req.url || ''
  
  // Handle service worker file requests
  if (url === '/dev-sw.js' || url === '/sw.js' || url.startsWith('/dev-sw.js') || url.startsWith('/sw.js')) {
    // Return 404 for service worker files in dev mode (they shouldn't exist anyway)
    event.node.res.statusCode = 404
    return { error: 'Service worker not available in development mode' }
  }
})

