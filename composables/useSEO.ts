export const useSEO = () => {
  const config = useRuntimeConfig()
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || 
                  config.public?.baseUrl || 
                  'https://unfold-notes.com'

  const setPageSEO = (options: {
    title: string
    description: string
    path?: string
    ogImage?: string
    keywords?: string[]
    noindex?: boolean
    type?: string
    schema?: any
  }) => {
    const canonicalUrl = `${baseUrl}${options.path || ''}`
    const ogImage = options.ogImage || `${baseUrl}/og-image.png` // You'll need to create this
    
    const metaTags = [
      // Basic meta
      {
        name: 'description',
        content: options.description
      },
      {
        name: 'keywords',
        content: (options.keywords || [
          'note taking app',
          'offline notes',
          'markdown editor',
          'collaborative notes',
          'AI note taking',
          'PWA notes',
          'free note app',
          'organize notes',
          'note taking software',
          'productivity app'
        ]).join(', ')
      },
      {
        name: 'robots',
        content: options.noindex ? 'noindex, nofollow' : 'index, follow'
      },
      
      // Open Graph
      {
        property: 'og:title',
        content: options.title
      },
      {
        property: 'og:description',
        content: options.description
      },
      {
        property: 'og:type',
        content: options.type || 'website'
      },
      {
        property: 'og:url',
        content: canonicalUrl
      },
      {
        property: 'og:image',
        content: ogImage
      },
      {
        property: 'og:image:width',
        content: '1200'
      },
      {
        property: 'og:image:height',
        content: '630'
      },
      {
        property: 'og:site_name',
        content: 'Unfold Notes'
      },
      
      // Twitter
      {
        name: 'twitter:card',
        content: 'summary_large_image'
      },
      {
        name: 'twitter:title',
        content: options.title
      },
      {
        name: 'twitter:description',
        content: options.description
      },
      {
        name: 'twitter:image',
        content: ogImage
      },
      
      // Additional
      {
        name: 'author',
        content: 'Unfold Notes'
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      }
    ]

    const links = [
      {
        rel: 'canonical',
        href: canonicalUrl
      }
    ]

    useHead({
      title: options.title,
      meta: metaTags,
      link: links,
      script: options.schema ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(options.schema)
        }
      ] : []
    })
  }

  return {
    setPageSEO,
    baseUrl
  }
}

