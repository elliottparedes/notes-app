/**
 * Extensible HTML to Markdown converter composable
 *
 * Usage:
 *   const { htmlToMarkdown, registerConverter } = useHtmlToMarkdown()
 *   const markdown = htmlToMarkdown(htmlString)
 *
 * To add custom converters:
 *   registerConverter('custom-tag', (element, convertChildren) => {
 *     return `Custom: ${convertChildren()}`
 *   })
 */

export interface ConverterContext {
  /** Convert child nodes to markdown */
  convertChildren: () => string
  /** Convert a specific node to markdown */
  convertNode: (node: Node) => string
  /** Get attribute value from element */
  getAttribute: (name: string) => string | null
  /** The element being converted */
  element: Element
}

export type ElementConverter = (ctx: ConverterContext) => string

export interface HtmlToMarkdownOptions {
  /** Preserve line breaks in text */
  preserveLineBreaks?: boolean
  /** Convert links to inline or reference style */
  linkStyle?: 'inline' | 'reference'
  /** Custom converters to override or extend defaults */
  converters?: Record<string, ElementConverter>
}

interface ConverterRegistry {
  [tagName: string]: ElementConverter
}

export function useHtmlToMarkdown(options: HtmlToMarkdownOptions = {}) {
  const {
    preserveLineBreaks = true,
    linkStyle = 'inline',
    converters: customConverters = {}
  } = options

  // Registry of tag converters
  const converterRegistry: ConverterRegistry = {}

  // Helper to escape markdown special characters in text
  function escapeMarkdown(text: string): string {
    // Only escape characters that would be interpreted as markdown
    // Don't escape inside code blocks (handled separately)
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  // Helper to clean up excessive whitespace
  function cleanWhitespace(text: string): string {
    return text
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ')      // Collapse spaces
      .trim()
  }

  // Convert a single node to markdown
  function convertNode(node: Node): string {
    // Text node
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      // Preserve meaningful whitespace but normalize
      return text.replace(/\s+/g, ' ')
    }

    // Element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()

      // Check for custom converter first, then built-in
      const converter = converterRegistry[tagName]

      if (converter) {
        const ctx: ConverterContext = {
          convertChildren: () => convertChildren(element),
          convertNode,
          getAttribute: (name: string) => element.getAttribute(name),
          element
        }
        return converter(ctx)
      }

      // Default: just return children content
      return convertChildren(element)
    }

    return ''
  }

  // Convert all children of an element
  function convertChildren(element: Element): string {
    let result = ''
    for (const child of Array.from(element.childNodes)) {
      result += convertNode(child)
    }
    return result
  }

  // Register a converter for a tag
  function registerConverter(tagName: string, converter: ElementConverter): void {
    converterRegistry[tagName.toLowerCase()] = converter
  }

  // Register multiple converters at once
  function registerConverters(converters: Record<string, ElementConverter>): void {
    for (const [tag, converter] of Object.entries(converters)) {
      registerConverter(tag, converter)
    }
  }

  // Initialize default converters
  function initDefaultConverters(): void {
    // Headings
    registerConverter('h1', ctx => `# ${ctx.convertChildren().trim()}\n\n`)
    registerConverter('h2', ctx => `## ${ctx.convertChildren().trim()}\n\n`)
    registerConverter('h3', ctx => `### ${ctx.convertChildren().trim()}\n\n`)
    registerConverter('h4', ctx => `#### ${ctx.convertChildren().trim()}\n\n`)
    registerConverter('h5', ctx => `##### ${ctx.convertChildren().trim()}\n\n`)
    registerConverter('h6', ctx => `###### ${ctx.convertChildren().trim()}\n\n`)

    // Inline formatting
    registerConverter('strong', ctx => `**${ctx.convertChildren()}**`)
    registerConverter('b', ctx => `**${ctx.convertChildren()}**`)
    registerConverter('em', ctx => `*${ctx.convertChildren()}*`)
    registerConverter('i', ctx => `*${ctx.convertChildren()}*`)
    registerConverter('u', ctx => `_${ctx.convertChildren()}_`)
    registerConverter('s', ctx => `~~${ctx.convertChildren()}~~`)
    registerConverter('strike', ctx => `~~${ctx.convertChildren()}~~`)
    registerConverter('del', ctx => `~~${ctx.convertChildren()}~~`)
    registerConverter('code', ctx => `\`${ctx.convertChildren()}\``)
    registerConverter('mark', ctx => `==${ctx.convertChildren()}==`)

    // Paragraphs and breaks
    registerConverter('p', ctx => `${ctx.convertChildren().trim()}\n\n`)
    registerConverter('br', () => preserveLineBreaks ? '\n' : ' ')
    registerConverter('hr', () => '\n---\n\n')

    // Links
    registerConverter('a', ctx => {
      const href = ctx.getAttribute('href') || ''
      const text = ctx.convertChildren().trim()
      const title = ctx.getAttribute('title')

      if (!href) return text

      if (linkStyle === 'reference') {
        return `[${text}][${href}]`
      }

      if (title) {
        return `[${text}](${href} "${title}")`
      }
      return `[${text}](${href})`
    })

    // Images
    registerConverter('img', ctx => {
      const src = ctx.getAttribute('src') || ''
      const alt = ctx.getAttribute('alt') || ''
      const title = ctx.getAttribute('title')

      if (title) {
        return `![${alt}](${src} "${title}")`
      }
      return `![${alt}](${src})`
    })

    // Lists
    registerConverter('ul', ctx => {
      const items = ctx.convertChildren()
      return `${items}\n`
    })

    registerConverter('ol', ctx => {
      const items = ctx.convertChildren()
      return `${items}\n`
    })

    registerConverter('li', ctx => {
      const parent = ctx.element.parentElement
      const isOrdered = parent?.tagName.toLowerCase() === 'ol'
      const content = ctx.convertChildren().trim()

      // Handle nested lists
      const hasNestedList = ctx.element.querySelector('ul, ol')
      const prefix = isOrdered
        ? `${Array.from(parent?.children || []).indexOf(ctx.element) + 1}. `
        : '- '

      if (hasNestedList) {
        // Indent nested content
        const lines = content.split('\n')
        const indented = lines.map((line, i) => i === 0 ? line : `  ${line}`).join('\n')
        return `${prefix}${indented}\n`
      }

      return `${prefix}${content}\n`
    })

    // Task lists (TipTap style)
    registerConverter('ul[data-type="taskList"]', ctx => ctx.convertChildren() + '\n')

    registerConverter('li[data-type="taskItem"]', ctx => {
      const checked = ctx.getAttribute('data-checked') === 'true'
      const content = ctx.convertChildren().trim()
      return `- [${checked ? 'x' : ' '}] ${content}\n`
    })

    // Blockquote
    registerConverter('blockquote', ctx => {
      const content = ctx.convertChildren().trim()
      const lines = content.split('\n')
      return lines.map(line => `> ${line}`).join('\n') + '\n\n'
    })

    // Code blocks
    registerConverter('pre', ctx => {
      const codeElement = ctx.element.querySelector('code')
      const language = codeElement?.className?.match(/language-(\w+)/)?.[1] || ''
      const code = codeElement?.textContent || ctx.element.textContent || ''
      return `\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`
    })

    // Tables
    registerConverter('table', ctx => {
      let result = '\n'
      const rows = ctx.element.querySelectorAll('tr')

      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('th, td')
        const cellContents: string[] = []

        cells.forEach(cell => {
          cellContents.push(convertChildren(cell).trim())
        })

        result += `| ${cellContents.join(' | ')} |\n`

        // Add header separator after first row if it contains th elements
        if (rowIndex === 0 && row.querySelector('th')) {
          result += `| ${cellContents.map(() => '---').join(' | ')} |\n`
        }
      })

      return result + '\n'
    })

    // Skip table sub-elements (handled by table converter)
    registerConverter('thead', ctx => ctx.convertChildren())
    registerConverter('tbody', ctx => ctx.convertChildren())
    registerConverter('tr', ctx => ctx.convertChildren())
    registerConverter('th', ctx => ctx.convertChildren())
    registerConverter('td', ctx => ctx.convertChildren())

    // Divs and spans (pass through)
    registerConverter('div', ctx => ctx.convertChildren())
    registerConverter('span', ctx => ctx.convertChildren())

    // YouTube embeds (custom TipTap extension)
    registerConverter('div[data-youtube-video]', ctx => {
      const iframe = ctx.element.querySelector('iframe')
      const src = iframe?.getAttribute('src') || ''
      const videoId = src.match(/embed\/([^?]+)/)?.[1] || ''
      if (videoId) {
        return `\n[YouTube Video](https://youtube.com/watch?v=${videoId})\n\n`
      }
      return ''
    })

    // Note links (custom extension)
    registerConverter('a[data-note-link]', ctx => {
      const noteId = ctx.getAttribute('data-note-id') || ctx.getAttribute('href')?.replace('#note:', '')
      const text = ctx.convertChildren().trim()
      return `[[${text}]]`
    })

    // Figures (images with captions)
    registerConverter('figure', ctx => {
      const img = ctx.element.querySelector('img')
      const caption = ctx.element.querySelector('figcaption')

      if (img) {
        const src = img.getAttribute('src') || ''
        const alt = img.getAttribute('alt') || caption?.textContent || ''
        return `![${alt}](${src})\n\n`
      }
      return ctx.convertChildren()
    })
  }

  // Main conversion function
  function htmlToMarkdown(html: string): string {
    if (!html || typeof html !== 'string') {
      return ''
    }

    // Check if we're on the server (no DOMParser available)
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
      // Fallback: basic regex-based HTML stripping for SSR
      return stripHtmlBasic(html)
    }

    // Parse HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Convert
    let markdown = convertChildren(doc.body)

    // Clean up
    markdown = cleanWhitespace(markdown)

    return markdown
  }

  // Basic HTML stripping fallback for SSR
  function stripHtmlBasic(html: string): string {
    return html
      // Headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      // Formatting
      .replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**')
      .replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*')
      .replace(/<(s|strike|del)[^>]*>(.*?)<\/\1>/gi, '~~$2~~')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      // Paragraphs and breaks
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n---\n\n')
      // Links and images
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
      .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)')
      // Lists (basic)
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<\/?[uo]l[^>]*>/gi, '\n')
      // Blockquote
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
      // Remove remaining tags
      .replace(/<[^>]+>/g, '')
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // Initialize converters
  initDefaultConverters()

  // Apply custom converters (override defaults)
  registerConverters(customConverters)

  return {
    htmlToMarkdown,
    registerConverter,
    registerConverters,
    escapeMarkdown,
    cleanWhitespace
  }
}

// Pre-configured instance for common use
export function useSimpleHtmlToMarkdown() {
  return useHtmlToMarkdown({
    preserveLineBreaks: true,
    linkStyle: 'inline'
  })
}
