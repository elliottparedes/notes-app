import { requireAuth } from '~/server/utils/auth';
import { htmlToMarkdown } from '~/server/utils/markdown';

interface PolishNoteRequest {
  title: string;
  content: string;
}

export default defineEventHandler(async (event) => {
  // Authenticate user
  await requireAuth(event);

  const body = await readBody<PolishNoteRequest>(event);
  const { title, content } = body;

  if (!title) {
    throw createError({
      statusCode: 400,
      message: 'Title is required'
    });
  }

  const config = useRuntimeConfig();
  const apiKey = config.openRouterApiKey;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured'
    });
  }

  try {
    // Convert HTML content to markdown to save tokens
    const markdownContent = content ? htmlToMarkdown(content) : '';

    // Prepare the prompt for the AI
    const prompt = `You are an expert note organizer and content editor. Your task is to take messy, unstructured notes and transform them into clean, well-organized content.

Given the following note:

Title: ${title}
Content:
${markdownContent || '(empty)'}

Please:
1. Reorganize and clean up the content into well-structured markdown
2. Fix any typos, grammar issues, and formatting problems
3. If it's a to-do list, organize it with proper task list formatting using - [ ] for unchecked and - [x] for checked items
4. If there are random thoughts, organize them into logical sections with headings
5. Preserve important information but make it more readable and professional
6. Use appropriate markdown: # ## ### for headings, **bold**, *italic*, - for lists, 1. for numbered lists
7. Keep the tone professional but approachable

Respond ONLY with the improved markdown content. Do NOT include the title in the response (it will be preserved separately). Do NOT wrap the content in code blocks or JSON. Just the raw markdown.`;

    // Stream the response from OpenRouter
    const stream = await streamOpenRouter(apiKey, [{ role: 'user', content: prompt }], 'qwen/qwen-turbo');

    return stream;

  } catch (error: any) {
    console.error('Polish API error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to polish note with AI'
    });
  }
});

