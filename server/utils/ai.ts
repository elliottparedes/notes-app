export async function streamOpenRouter(
  apiKey: string,
  messages: any[],
  model: string,
  options: { maxTokens?: number; temperature?: number } = {}
) {
  const { maxTokens = 16384, temperature = 0.7 } = options;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://markdown-notes-app.netlify.app',
        'X-Title': 'Markdown Notes App'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: `AI Provider Error: ${response.statusText}`
      });
    }

    if (!response.body) {
      throw createError({
        statusCode: 500,
        message: 'No response body from AI provider'
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    return new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            // Note: This simple splitting might break if a JSON object is split across chunks
            // But for SSE "data: " lines, it's usually fine as they are newline delimited
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              
              if (trimmedLine.startsWith('data: ')) {
                try {
                  const data = JSON.parse(trimmedLine.slice(6));
                  const content = data.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  // Ignore parse errors for partial lines
                }
              }
            }
          }
          controller.close();
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        }
      }
    });
  } catch (error: any) {
    console.error('streamOpenRouter error:', error);
    throw error;
  }
}
