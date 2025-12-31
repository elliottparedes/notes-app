/**
 * Server-side Markdown <-> HTML conversion utilities
 * Used for API key requests to provide a developer-friendly markdown interface
 */

import { marked } from 'marked';

// Configure marked for safe HTML output
marked.setOptions({
  gfm: true,        // GitHub Flavored Markdown
  breaks: true,     // Convert \n to <br>
});

/**
 * Convert Markdown to HTML (for API input)
 * Transforms markdown content into TipTap-compatible HTML
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // Parse markdown to HTML
  let html = marked.parse(markdown, { async: false }) as string;

  // Post-process for TipTap compatibility
  html = postProcessForTipTap(html);

  return html;
}

/**
 * Post-process HTML for TipTap editor compatibility
 */
function postProcessForTipTap(html: string): string {
  return html
    // Ensure paragraphs are properly formatted
    .replace(/<p>\s*<\/p>/g, '<p></p>')
    // Convert task list items to TipTap format
    .replace(
      /<li>\s*\[([ xX])\]\s*/g,
      (_, checked) => `<li data-type="taskItem" data-checked="${checked.toLowerCase() === 'x'}"><label><input type="checkbox" ${checked.toLowerCase() === 'x' ? 'checked' : ''}></label><div>`
    )
    .replace(/<\/li>/g, (match, offset, string) => {
      // Check if this is a task item by looking backwards
      const before = string.substring(Math.max(0, offset - 200), offset);
      if (before.includes('data-type="taskItem"')) {
        return '</div></li>';
      }
      return match;
    })
    // Convert task lists to TipTap format
    .replace(/<ul>\s*(<li data-type="taskItem")/g, '<ul data-type="taskList">$1')
    // Handle wiki-style note links [[Note Title]]
    .replace(
      /\[\[([^\]]+)\]\]/g,
      '<a data-note-link="true" href="#note:$1">$1</a>'
    )
    // Clean up excessive whitespace
    .trim();
}

/**
 * Convert HTML to Markdown (for API output)
 * Server-side implementation without DOM dependencies
 */
export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let markdown = html;

  // Process in order to handle nested elements correctly

  // Code blocks (must be before inline code)
  markdown = markdown.replace(
    /<pre[^>]*><code(?:\s+class="language-(\w+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_, lang, code) => {
      const decoded = decodeHtmlEntities(code);
      return `\n\`\`\`${lang || ''}\n${decoded.trim()}\n\`\`\`\n\n`;
    }
  );

  // Headings
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');

  // Bold, italic, strikethrough (handle nested)
  markdown = markdown.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  markdown = markdown.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  markdown = markdown.replace(/<(s|strike|del)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');
  markdown = markdown.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '_$2_');
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  markdown = markdown.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==');

  // Links - handle note links specially
  markdown = markdown.replace(
    /<a[^>]*data-note-link[^>]*>([^<]*)<\/a>/gi,
    '[[$1]]'
  );
  markdown = markdown.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi,
    '[$2]($1)'
  );

  // Images
  markdown = markdown.replace(
    /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi,
    '![$2]($1)'
  );
  markdown = markdown.replace(
    /<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi,
    '![$1]($2)'
  );
  markdown = markdown.replace(
    /<img[^>]*src="([^"]*)"[^>]*\/?>/gi,
    '![]($1)'
  );

  // Task lists (TipTap format)
  markdown = markdown.replace(
    /<li[^>]*data-type="taskItem"[^>]*data-checked="true"[^>]*>[\s\S]*?<\/li>/gi,
    (match) => {
      const text = match.replace(/<[^>]+>/g, '').trim();
      return `- [x] ${text}\n`;
    }
  );
  markdown = markdown.replace(
    /<li[^>]*data-type="taskItem"[^>]*data-checked="false"[^>]*>[\s\S]*?<\/li>/gi,
    (match) => {
      const text = match.replace(/<[^>]+>/g, '').trim();
      return `- [ ] ${text}\n`;
    }
  );
  markdown = markdown.replace(/<ul[^>]*data-type="taskList"[^>]*>/gi, '');

  // Regular lists
  markdown = markdown.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  markdown = markdown.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Blockquotes
  markdown = markdown.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, content) => {
      const lines = content.replace(/<[^>]+>/g, '').trim().split('\n');
      return lines.map((line: string) => `> ${line}`).join('\n') + '\n\n';
    }
  );

  // Horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n\n');

  // Paragraphs and breaks
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Tables
  markdown = processTablesForMarkdown(markdown);

  // YouTube embeds
  markdown = markdown.replace(
    /<div[^>]*data-youtube-video[^>]*>[\s\S]*?<iframe[^>]*src="[^"]*embed\/([^"?]+)[^"]*"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi,
    '\n[YouTube Video](https://youtube.com/watch?v=$1)\n\n'
  );

  // Remove remaining HTML tags
  markdown = markdown.replace(/<div[^>]*>/gi, '');
  markdown = markdown.replace(/<\/div>/gi, '\n');
  markdown = markdown.replace(/<span[^>]*>/gi, '');
  markdown = markdown.replace(/<\/span>/gi, '');
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = decodeHtmlEntities(markdown);

  // Clean up whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  return markdown;
}

/**
 * Process HTML tables into markdown format
 */
function processTablesForMarkdown(html: string): string {
  return html.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (_, tableContent) => {
      const rows: string[][] = [];
      let hasHeader = false;

      // Extract rows
      const rowMatches = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

      rowMatches.forEach((row: string, index: number) => {
        const cells: string[] = [];
        const cellMatches = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];

        cellMatches.forEach((cell: string) => {
          const isHeader = cell.startsWith('<th');
          if (index === 0 && isHeader) hasHeader = true;

          const content = cell
            .replace(/<t[hd][^>]*>/gi, '')
            .replace(/<\/t[hd]>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();
          cells.push(content);
        });

        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length === 0) return '';

      // Build markdown table
      let table = '\n';
      const colCount = Math.max(...rows.map(r => r.length));

      rows.forEach((row, index) => {
        // Pad row to column count
        while (row.length < colCount) row.push('');
        table += `| ${row.join(' | ')} |\n`;

        // Add separator after header
        if (index === 0) {
          table += `| ${row.map(() => '---').join(' | ')} |\n`;
        }
      });

      return table + '\n';
    }
  );
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Check if content appears to be markdown (vs HTML)
 */
export function isLikelyMarkdown(content: string): boolean {
  if (!content) return false;

  // If it has HTML tags, it's probably HTML
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return false;
  }

  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Headings
    /\*\*[^*]+\*\*/,        // Bold
    /\*[^*]+\*/,            // Italic
    /\[.+\]\(.+\)/,         // Links
    /^\s*[-*+]\s/m,         // Unordered list
    /^\s*\d+\.\s/m,         // Ordered list
    /^\s*>/m,               // Blockquote
    /`[^`]+`/,              // Inline code
    /```[\s\S]*```/,        // Code block
    /^\s*-\s*\[[ xX]\]/m,   // Task list
    /\[\[[^\]]+\]\]/,       // Wiki links
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
}

/**
 * Transform page content for API response (HTML -> Markdown)
 */
export function transformContentForApiResponse(content: string | null): string | null {
  if (!content) return content;
  console.log('[Markdown] Transforming HTML to Markdown, input length:', content.length);
  const result = htmlToMarkdown(content);
  console.log('[Markdown] Output length:', result.length, '| First 100 chars:', result.substring(0, 100));
  return result;
}

/**
 * Transform page content from API request (Markdown -> HTML)
 */
export function transformContentFromApiRequest(content: string | null): string | null {
  if (!content) return content;

  // If it's already HTML, return as-is
  if (!isLikelyMarkdown(content)) {
    return content;
  }

  return markdownToHtml(content);
}
