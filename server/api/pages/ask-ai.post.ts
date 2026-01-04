import { requireAuth } from '~/server/utils/auth';
import { htmlToMarkdown } from '~/server/utils/markdown';

interface AskAIRequest {
  title: string;
  content: string;
  prompt: string;
}

export default defineEventHandler(async (event) => {
  // Authenticate user
  await requireAuth(event);

  const body = await readBody<AskAIRequest>(event);
  const { title, content, prompt } = body;

  if (!prompt || prompt.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Prompt is required'
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
    const systemPrompt = `You are an AI assistant helping to modify and improve notes. The user will provide you with:
1. A note title (if available)
2. The current note content in markdown format (which may be empty)
3. A specific prompt/request for how to modify the note

Your task is to generate the modified note content based on the user's prompt. Return ONLY markdown content.

Guidelines:
- Follow the user's prompt exactly and comprehensively
- If the note is empty, create substantial, detailed content based on the prompt
- If the note has content, modify it according to the prompt while preserving or expanding relevant information
- Don't be overly brief - provide thorough, well-developed content that fully addresses the user's request
- Use markdown formatting: # ## ### for headings, **bold**, *italic*, - for bullet lists, 1. for numbered lists
- For task lists (checkboxes), use - [ ] for unchecked and - [x] for checked items
- Preserve the structure and style of the original note when appropriate, but feel free to expand and enhance it
- Make sure the content is well-formatted, readable, and comprehensive
- Do NOT wrap the content in code blocks or JSON. Just the raw markdown.`;

    const userPrompt = `Note Title: ${title || 'Untitled Note'}
Current Note Content:
${markdownContent || '(empty note)'}

User Request: ${prompt}

Please modify the note according to the user's request. Provide a comprehensive, well-developed response that fully addresses their request. Return ONLY the raw markdown content.`;

    // Stream the response from OpenRouter
    const stream = await streamOpenRouter(apiKey, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 'qwen/qwen3-max');

    return stream;

  } catch (error: any) {
    console.error('AskAI API error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to process AI request'
    });
  }
});

