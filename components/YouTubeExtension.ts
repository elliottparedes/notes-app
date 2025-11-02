import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Utility function to extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

/**
 * Utility function to convert YouTube URL to embed URL
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeId(url)
  if (!videoId) return null
  
  return `https://www.youtube.com/embed/${videoId}`
}

/**
 * TipTap extension for embedding YouTube videos
 */
export const YouTube = Node.create({
  name: 'youtube',
  
  group: 'block',
  
  atom: true,
  
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => ({
          src: attributes.src,
        }),
      },
      width: {
        default: 560,
        parseHTML: element => element.getAttribute('width') || 560,
        renderHTML: attributes => ({
          width: attributes.width,
        }),
      },
      height: {
        default: 315,
        parseHTML: element => element.getAttribute('height') || 315,
        renderHTML: attributes => ({
          height: attributes.height,
        }),
      },
    }
  },
  
  parseHTML() {
    return [
      {
        tag: 'div.youtube-wrapper',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const element = node as HTMLElement
          const iframe = element.querySelector('iframe[src*="youtube.com/embed"]')
          if (!iframe) return false
          return {
            src: iframe.getAttribute('src'),
            width: iframe.getAttribute('width') || 560,
            height: iframe.getAttribute('height') || 315,
          }
        },
      },
      {
        tag: 'iframe[src*="youtube.com/embed"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const element = node as HTMLElement
          return {
            src: element.getAttribute('src'),
            width: element.getAttribute('width') || 560,
            height: element.getAttribute('height') || 315,
          }
        },
      },
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { class: 'youtube-wrapper' },
      [
        'iframe',
        mergeAttributes(
          {
            width: 560,
            height: 315,
            frameborder: '0',
            allowfullscreen: 'true',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          },
          HTMLAttributes
        ),
      ],
    ]
  },
  
  addCommands() {
    return {
      setYouTube: (options: { src: string }) => {
        return ({ commands }) => {
          // Try to extract YouTube ID and convert to embed URL
          const embedUrl = getYouTubeEmbedUrl(options.src) || options.src
          
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: embedUrl,
              width: 560,
              height: 315,
            },
          })
        }
      },
    }
  },
})

