import { defineEventHandler } from 'h3';
import { requireAuth } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  // Authenticate user
  await requireAuth(event);

  const body = await readBody(event);
  const { messages } = body;

  if (!messages || !Array.isArray(messages)) {
    throw createError({
      statusCode: 400,
      message: 'Messages array is required'
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
    // Call OpenRouter API with anthropic/claude-haiku-4.5
    const response = await $fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://markdown-notes-app.netlify.app',
        'X-Title': 'Markdown Notes App'
      },
      body: {
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Provide clear, concise, and helpful responses. Keep responses brief and to the point for quick questions.'
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 2000
      }
    });

    const aiResponse = (response as any).choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw createError({
        statusCode: 500,
        message: 'No response from AI'
      });
    }

    return {
      content: aiResponse
    };
  } catch (error: any) {
    console.error('AI chat error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.data?.message || error.message || 'Failed to get AI response'
    });
  }
});

