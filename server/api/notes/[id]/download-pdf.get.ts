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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 60px 80px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      font-size: 2.5em;
      font-weight: 700;
      margin-bottom: 10px;
      color: #111;
    }
    .metadata {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 0.9em;
      color: #6b7280;
      margin-top: 10px;
    }
    .metadata-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .tag {
      background: #f3f4f6;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      color: #374151;
    }
    .content {
      font-size: 1em;
      line-height: 1.8;
    }
    .content h1, .content h2, .content h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    .content h1 {
      font-size: 2em;
    }
    .content h2 {
      font-size: 1.5em;
    }
    .content h3 {
      font-size: 1.25em;
    }
    .content p {
      margin-bottom: 1em;
    }
    .content ul, .content ol {
      margin-left: 2em;
      margin-bottom: 1em;
    }
    .content li {
      margin-bottom: 0.5em;
    }
    .content blockquote {
      border-left: 4px solid #d1d5db;
      padding-left: 1em;
      margin: 1em 0;
      color: #6b7280;
      font-style: italic;
    }
    .content code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .content pre {
      background: #f3f4f6;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1em 0;
    }
    .content pre code {
      background: none;
      padding: 0;
    }
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }
    .content table th,
    .content table td {
      border: 1px solid #d1d5db;
      padding: 0.75em;
      text-align: left;
    }
    .content table th {
      background: #f9fafb;
      font-weight: 600;
    }
    .content img {
      max-width: 100%;
      height: auto;
      margin: 1em 0;
      border-radius: 8px;
    }
    .content a {
      color: #2563eb;
      text-decoration: underline;
    }
    .content hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2em 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 0.85em;
      color: #9ca3af;
      text-align: center;
    }
    @media print {
      body {
        padding: 40px 60px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(noteTitle)}</h1>
    <div class="metadata">
      <div class="metadata-item">
        <span>Created:</span>
        <span>${escapeHtml(createdAt)}</span>
      </div>
      <div class="metadata-item">
        <span>Updated:</span>
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
    ${noteContent}
  </div>
  <div class="footer">
    Generated from Notes App
  </div>
</body>
</html>
      `;

      // Set content and wait for any images/fonts to load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
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

