import { executeQuery, parseJsonField } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';

interface NoteRow {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string | null;
  created_at: Date;
  updated_at: Date;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  try {
    // Fetch note
    const rows = await executeQuery<NoteRow[]>(
      `SELECT n.*, 
        sn.permission as share_permission
       FROM notes n
       LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
       WHERE n.id = ? AND (n.user_id = ? OR sn.shared_with_user_id IS NOT NULL)
       LIMIT 1`,
      [userId, noteId, userId]
    );

    const row = rows[0];
    
    if (!row) {
      throw createError({
        statusCode: 404,
        message: 'Note not found or access denied'
      });
    }

    const noteTitle = row.title || 'Untitled Note';
    const noteContent = row.content || '';
    const tags = parseJsonField<string[]>(row.tags) || [];
    const createdAt = new Date(row.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const updatedAt = new Date(row.updated_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Process note content to ensure custom nodes like NoteLink render correctly
    let processedContent = noteContent;
    
    // Robust replacement for NoteLink spans that might be empty
    // This regex is safer and won't cut off content if labels have special characters
    processedContent = processedContent.replace(/<span[^>]+class="[^"]*note-link[^"]*"[^>]*>(.*?)<\/span>/g, (match, inner) => {
      // If it already has content, just return the match
      if (inner && inner.trim()) return match;
      
      // If empty, try to extract the label from the data-label attribute
      const labelMatch = match.match(/data-label="([^"]*)"/);
      if (labelMatch && labelMatch[1]) {
        return match.replace('><', `>${labelMatch[1]}<`);
      }
      return match;
    });

    // Determine if we're in a serverless environment
    const isServerless = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL || process.env.NETLIFY;
    
    // Try to use full puppeteer (includes Chromium) for local dev, fallback to puppeteer-core for serverless
    let puppeteer: typeof puppeteerCore;
    try {
      // Try to import full puppeteer (has Chromium bundled) - this will work in local dev
      const puppeteerFull = await import('puppeteer');
      puppeteer = puppeteerFull.default || puppeteerFull;
    } catch {
      // Fallback to puppeteer-core (requires external Chrome/Chromium) - for serverless
      puppeteer = puppeteerCore;
    }
    
    // Launch browser with appropriate configuration
    let browser;
    if (isServerless) {
      // Serverless environment - use chromium
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Local development - try to use puppeteer's bundled Chromium first
      // If puppeteer (full) is available, it includes Chromium bundled
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          ignoreHTTPSErrors: true,
        });
      } catch (error: any) {
        // If that fails, try with chromium package
        try {
          const chromiumPath = await chromium.executablePath();
          const fs = await import('fs');
          if (fs.existsSync(chromiumPath)) {
            browser = await puppeteer.launch({
              args: chromium.args,
              defaultViewport: chromium.defaultViewport,
              executablePath: chromiumPath,
              headless: chromium.headless,
              ignoreHTTPSErrors: true,
            });
          } else {
            throw createError({
              statusCode: 500,
              message: 'PDF generation failed. Please ensure puppeteer is installed (npm install puppeteer).'
            });
          }
        } catch (chromiumError: any) {
          throw createError({
            statusCode: 500,
            message: 'PDF generation failed. Please ensure puppeteer is installed (npm install puppeteer).'
          });
        }
      }
    }

    try {
      const page = await browser.newPage();

      // Create HTML content for PDF
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(noteTitle)}</title>
  <style>
    :root {
      --primary: #4f46e5;
      --primary-light: #eef2ff;
      --text-main: #1f2937;
      --text-muted: #6b7280;
      --border: #e5e7eb;
      --bg-soft: #f9fafb;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      color: var(--text-main);
      padding: 40px 50px;
      max-width: 850px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      position: relative;
    }
    h1 {
      font-size: 2.75rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 16px;
      color: #111827;
      letter-spacing: -0.02em;
    }
    .metadata {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .metadata-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .metadata-label {
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.02em;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 16px;
    }
    .tag {
      background: var(--primary-light);
      padding: 2px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
    }
    .content {
      font-size: 1.05rem;
    }
    .content h1, .content h2, .content h3 {
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      font-weight: 700;
      color: #111827;
      line-height: 1.3;
    }
    .content h1 { font-size: 1.8rem; }
    .content h2 { font-size: 1.5rem; }
    .content h3 { font-size: 1.25rem; }
    
    .content p {
      margin-bottom: 1.25rem;
    }
    .content ul, .content ol {
      margin-left: 1.5rem;
      margin-bottom: 1.25rem;
    }
    .content li {
      margin-bottom: 0.5rem;
      padding-left: 0.25rem;
    }
    .content blockquote {
      border-left: 4px solid var(--primary);
      background: var(--bg-soft);
      padding: 1.25rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 0 8px 8px 0;
      color: #4b5563;
      font-style: italic;
    }
    .content code {
      background: var(--bg-soft);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.9em;
      color: #eb5757;
      border: 1px solid #eee;
    }
    .content pre {
      background: #1e293b;
      color: #f8fafc;
      padding: 1.5rem;
      border-radius: 12px;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .content pre code {
      background: none;
      padding: 0;
      border: none;
      color: inherit;
    }
    .content table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 2rem 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    .content table th,
    .content table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .content table th {
      background: var(--bg-soft);
      font-weight: 700;
      font-size: 0.85rem;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.02em;
    }
    .content table tr:last-child td {
      border-bottom: none;
    }
    .content img {
      max-width: 100%;
      height: auto;
      margin: 2rem 0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .content a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid var(--primary-light);
    }
    .content .note-link {
      color: var(--primary) !important;
      font-weight: 600;
      text-decoration: none !important;
      display: inline-block;
      background: var(--primary-light);
      padding: 0 6px;
      border-radius: 4px;
    }
    .content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 3rem 0;
    }
    .footer {
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .header {
        border-bottom-width: 2px;
      }
    }
    
    /* Page break control */
    h1, h2, h3 { page-break-after: avoid; }
    pre, blockquote, table, img { page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(noteTitle)}</h1>
    <div class="metadata">
      <div class="metadata-item">
        <span class="metadata-label">Created</span>
        <span>${escapeHtml(createdAt)}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Modified</span>
        <span>${escapeHtml(updatedAt)}</span>
      </div>
    </div>
    ${tags.length > 0 ? `
      <div class="tags">
        ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
    ` : ''}
  </div>
  <div class="content">
    ${processedContent}
  </div>
  <div class="footer">
    <span>Generated on ${new Date().toLocaleDateString()}</span>
  </div>
</body></html>
      `;

      // Set content and wait for any images/fonts to load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      // Set response headers
      setHeader(event, 'Content-Type', 'application/pdf');
      setHeader(event, 'Content-Disposition', `attachment; filename="${sanitizeFilename(noteTitle)}.pdf"`);

      return pdf;
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    console.error('PDF generation error:', error);
    
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to generate PDF'
    });
  }
});

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Helper function to sanitize filename
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100) || 'note';
}

