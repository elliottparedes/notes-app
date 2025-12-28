import { requireAuth } from '~/server/utils/auth';

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
    // Prepare the prompt for the AI
    const prompt = `You are an expert note organizer and content editor. Your task is to take messy, unstructured notes and transform them into clean, well-organized content.

Given the following note:

Title: ${title}
Content: ${content || '(empty)'}

Please:
1. Reorganize and clean up the content into well-structured HTML
2. Fix any typos, grammar issues, and formatting problems
3. If it's a to-do list, organize it with proper task list formatting using <ul data-type="taskList"><li data-type="taskItem" data-checked="false">Task content</li></ul>
4. If there are random thoughts, organize them into logical sections with headings
5. Preserve important information but make it more readable and professional
6. Use appropriate HTML tags: <h1>, <h2>, <h3> for headings, <p> for paragraphs, <ul>/<ol> for lists, <strong> and <em> for emphasis
7. Keep the tone professional but approachable

Respond ONLY with the improved HTML content. Do NOT include the title in the response (it will be preserved separately). Do NOT wrap the content in markdown code blocks or JSON. Just the raw HTML.`;

    // Stream the response from OpenRouter
    const stream = await streamOpenRouter(apiKey, [{ role: 'user', content: prompt }], 'x-ai/grok-4.1-fast');
    
    return stream;

  } catch (error: any) {
    console.error('Polish API error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to polish note with AI'
    });
  }
});

