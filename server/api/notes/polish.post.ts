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
1. Keep the original title exactly as provided - do NOT change or modify it
2. Reorganize and clean up the content into well-structured HTML
3. Fix any typos, grammar issues, and formatting problems
4. If it's a to-do list, organize it with proper task list formatting using <ul data-type="taskList"><li data-type="taskItem" data-checked="false">Task content</li></ul>
5. If there are random thoughts, organize them into logical sections with headings
6. Preserve important information but make it more readable and professional
7. Use appropriate HTML tags: <h1>, <h2>, <h3> for headings, <p> for paragraphs, <ul>/<ol> for lists, <strong> and <em> for emphasis
8. Keep the tone professional but approachable, similar to Notion's style

Respond ONLY with a JSON object in this exact format:
{
  "title": "${title}",
  "content": "<p>improved HTML content here</p>"
}

IMPORTANT: Use the exact original title "${title}" in the response - do not modify it.

Do not include any markdown formatting. Use HTML tags only.`;

    // Call OpenRouter API
    const response = await $fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://markdown-notes-app.netlify.app',
        'X-Title': 'Markdown Notes App'
      },
      body: {
        model: 'anthropic/claude-4.5-sonnet',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8192
      }
    });

    // Extract the AI response
    const aiResponse = (response as any).choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw createError({
        statusCode: 500,
        message: 'No response from AI'
      });
    }

    // Try to parse JSON from the response
    let polishedNote;
    try {
      // Sometimes the AI might include markdown code blocks, so let's handle that
      let jsonString = aiResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      polishedNote = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw createError({
        statusCode: 500,
        message: 'Failed to parse AI response'
      });
    }

    // Validate the response has the expected structure
    if (!polishedNote.content) {
      throw createError({
        statusCode: 500,
        message: 'Invalid AI response format'
      });
    }

    // Always return the original title, not the AI-generated one
    return {
      title: title,
      content: polishedNote.content
    };

  } catch (error: any) {
    console.error('Polish API error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to polish note with AI'
    });
  }
});

