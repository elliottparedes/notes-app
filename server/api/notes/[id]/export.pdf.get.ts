import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import puppeteer from 'puppeteer-core';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');

  if (!noteId) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required'
    });
  }

  // Verify note exists and user has permission
  const noteRows = await executeQuery<Array<{
    id: string;
    user_id: number;
    title: string;
    content: string | null;
  }>>(
    `SELECT n.id, n.user_id, n.title, n.content
     FROM notes n
     LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
     WHERE n.id = ? AND (n.user_id = ? OR sn.permission IN ('viewer', 'editor'))`,
    [userId, noteId, userId]
  );

  if (noteRows.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Note not found or you do not have permission'
    });
  }

  const note = noteRows[0];

  try {
    // Determine if we're in a serverless/production environment
    // Check for various serverless platforms
    // Note: Only use @sparticuz/chromium on actual serverless platforms
    const isServerless = 
      process.env.AWS_LAMBDA_FUNCTION_NAME || 
      process.env.VERCEL || 
      process.env.NETLIFY;
    
    let browserOptions: any = {
      headless: true,
      ignoreHTTPSErrors: true,
    };

    if (isServerless) {
      // Use serverless chromium in production/serverless
      try {
        const chromiumModule = await import('@sparticuz/chromium');
        // Handle both default and named exports
        // @sparticuz/chromium can export as default or as named exports
        const chromium = (chromiumModule as any).default || chromiumModule;
        
        if (!chromium) {
          throw new Error('Failed to load @sparticuz/chromium module');
        }
        
        // Set graphics mode if available
        if (typeof chromium.setGraphicsMode === 'function') {
          chromium.setGraphicsMode(false);
        }
        
        // Get executablePath - check what type it is
        let executablePath: string;
        const executablePathValue = chromium.executablePath;
        
        if (!executablePathValue) {
          throw new Error('chromium.executablePath is not available in @sparticuz/chromium module');
        }
        
        if (typeof executablePathValue === 'function') {
          // It's a function, call it (it returns a Promise)
          executablePath = await executablePathValue();
        } else if (typeof executablePathValue === 'string') {
          // It's already a string
          executablePath = executablePathValue;
        } else {
          // Try to convert to string or use as-is
          executablePath = String(executablePathValue);
        }
        
        if (!executablePath || typeof executablePath !== 'string') {
          throw new Error('Failed to get valid executablePath from @sparticuz/chromium');
        }
        
        browserOptions = {
          args: chromium.args || [],
          defaultViewport: chromium.defaultViewport || { width: 1280, height: 720 },
          executablePath: executablePath,
          headless: chromium.headless !== false,
          ignoreHTTPSErrors: true,
        };
      } catch (chromiumError: any) {
        console.error('Failed to load @sparticuz/chromium:', chromiumError);
        console.error('Error details:', {
          message: chromiumError.message,
          stack: chromiumError.stack,
          name: chromiumError.name
        });
        throw createError({
          statusCode: 500,
          message: `PDF generation failed: ${chromiumError.message || 'Chromium initialization error'}`
        });
      }
    } else {
      // Local development - use system Chrome/Chromium or download puppeteer's Chromium
      // Try to find Chrome/Chromium in common locations
      const { execSync } = await import('child_process');
      let executablePath: string | undefined;
      
      try {
        // Try to find Chrome on macOS
        if (process.platform === 'darwin') {
          const chromePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ];
          for (const path of chromePaths) {
            try {
              execSync(`test -f "${path}"`, { stdio: 'ignore' });
              executablePath = path;
              break;
            } catch {
              // Path doesn't exist, try next
            }
          }
        }
        // For other platforms, you might want to add similar checks
      } catch {
        // Fallback to using puppeteer's bundled chromium if available
        // In local dev, you might have puppeteer installed which includes chromium
        try {
          // @ts-ignore - puppeteer is optional, only used in local dev
          const puppeteerFull = await import('puppeteer');
          executablePath = (puppeteerFull as any).executablePath();
        } catch {
          // If puppeteer is not available, try without executablePath
          // This will fail with a clear error if Chrome is not found
        }
      }
      
      if (executablePath) {
        browserOptions.executablePath = executablePath;
      }
    }

    // Launch browser
    const browser = await puppeteer.launch(browserOptions);

    const page = await browser.newPage();

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            h1 {
              font-size: 32px;
              font-weight: 700;
              margin: 0 0 30px 0;
              color: #1a1a1a;
              border-bottom: 2px solid #e5e5e5;
              padding-bottom: 20px;
            }
            .content {
              font-size: 16px;
              line-height: 1.8;
            }
            .content h1, .content h2, .content h3 {
              margin-top: 30px;
              margin-bottom: 15px;
              font-weight: 600;
            }
            .content h1 { font-size: 28px; }
            .content h2 { font-size: 24px; }
            .content h3 { font-size: 20px; }
            .content p {
              margin: 15px 0;
            }
            .content ul, .content ol {
              margin: 15px 0;
              padding-left: 30px;
            }
            .content li {
              margin: 8px 0;
            }
            .content blockquote {
              border-left: 4px solid #ddd;
              padding-left: 20px;
              margin: 20px 0;
              color: #666;
              font-style: italic;
            }
            .content code {
              background: #f5f5f5;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              font-size: 14px;
            }
            .content pre {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
            }
            .content pre code {
              background: none;
              padding: 0;
            }
            .content table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .content table th,
            .content table td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
            }
            .content table th {
              background: #f5f5f5;
              font-weight: 600;
            }
            .content img {
              max-width: 100%;
              height: auto;
              margin: 20px 0;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(note.title || 'Untitled Note')}</h1>
          <div class="content">${note.content || ''}</div>
        </body>
      </html>
    `;

    // Set content and wait for rendering
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    await browser.close();

    // Set response headers
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${escapeFilename(note.title || 'note')}.pdf"`
    );

    return pdfBuffer;
  } catch (error: any) {
    console.error('PDF generation error:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to generate PDF'
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

// Helper function to escape filename
function escapeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

