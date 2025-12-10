import { requireAuth } from '~/server/utils/auth';

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
    // Prepare the prompt for the AI
    const systemPrompt = `You are an AI assistant helping to modify and improve notes. The user will provide you with:
1. A note title (if available)
2. The current note content (which may be empty)
3. A specific prompt/request for how to modify the note

Your task is to generate the modified note content based on the user's prompt. Return ONLY a JSON object with the modified content.

Guidelines:
- Follow the user's prompt exactly and comprehensively
- If the note is empty, create substantial, detailed content based on the prompt
- If the note has content, modify it according to the prompt while preserving or expanding relevant information
- Don't be overly brief - provide thorough, well-developed content that fully addresses the user's request
- Use HTML formatting: <h1>, <h2>, <h3> for headings, <p> for paragraphs, <ul>/<ol> for lists, <strong> and <em> for emphasis
- Preserve the structure and style of the original note when appropriate, but feel free to expand and enhance it
- Make sure the content is well-formatted, readable, and comprehensive`;

    const userPrompt = `Note Title: ${title || 'Untitled Note'}
Current Note Content:
${content || '(empty note)'}

User Request: ${prompt}

Please modify the note according to the user's request. Provide a comprehensive, well-developed response that fully addresses their request. Don't be overly brief - expand and develop the content as needed.

Return ONLY a JSON object in this exact format:
{
  "content": "<p>modified HTML content here</p>"
}

Do not include any markdown formatting. Use HTML tags only.`;

    // Call OpenRouter API with Gemini 3 Pro Preview
    const response = await $fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://markdown-notes-app.netlify.app',
        'X-Title': 'Markdown Notes App'
      },
      body: {
        model: 'google/gemini-3-pro-preview',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8000
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
    let modifiedNote;
    try {
      // Sometimes the AI might include markdown code blocks, so let's handle that
      let jsonString = aiResponse.trim();
      
      // Remove markdown code blocks if present
      if (jsonString.includes('```json')) {
        const codeBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonString = codeBlockMatch[1];
        }
      } else if (jsonString.includes('```')) {
        const codeBlockMatch = jsonString.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonString = codeBlockMatch[1];
        }
      }
      
      // Try to find JSON object even if there's text around it
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
      
      modifiedNote = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // If JSON parsing fails, try to extract HTML content directly
      // Sometimes the AI might return just HTML without JSON wrapper
      if (aiResponse.includes('<p>') || aiResponse.includes('<h')) {
        // Assume the response is HTML content
        modifiedNote = { content: aiResponse.trim() };
      } else {
        throw createError({
          statusCode: 500,
          message: 'Failed to parse AI response'
        });
      }
    }

    // Validate the response has the expected structure
    if (!modifiedNote.content) {
      throw createError({
        statusCode: 500,
        message: 'Invalid AI response format'
      });
    }

    return {
      content: modifiedNote.content
    };

  } catch (error: any) {
    console.error('AskAI API error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to process AI request'
    });
  }
});

