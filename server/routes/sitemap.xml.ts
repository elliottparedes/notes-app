export default defineEventHandler(async (event) => {
  // Set XML content type
  event.node.res.setHeader('Content-Type', 'application/xml')
  
  // Get base URL from environment or config
  // Set NUXT_PUBLIC_BASE_URL environment variable with your actual domain (e.g., https://unfoldnotes.com)
  const config = useRuntimeConfig()
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 
                  config.public?.baseUrl || 
                  'https://unfold-notes.com' // TODO: Replace with your actual domain
  
  // Get current date in ISO format
  const lastmod = new Date().toISOString().split('T')[0]
  
  // Public pages to include in sitemap
  const pages = [
    { url: '', priority: '1.0', changefreq: 'weekly' }, // Home
    { url: '/features', priority: '0.9', changefreq: 'monthly' },
    { url: '/use-cases', priority: '0.9', changefreq: 'monthly' },
    { url: '/about', priority: '0.8', changefreq: 'monthly' },
    { url: '/faq', priority: '0.8', changefreq: 'monthly' },
    { url: '/login', priority: '0.5', changefreq: 'monthly' },
    { url: '/signup', priority: '0.9', changefreq: 'monthly' },
  ]
  
  // Generate XML sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`
  
  return sitemap
})

