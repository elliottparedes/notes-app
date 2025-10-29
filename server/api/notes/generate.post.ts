import type { CreateNoteDto, Note } from '../../../models';
import type { ResultSetHeader } from 'mysql2';
import { executeQuery, parseJsonField } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import { randomUUID } from 'crypto';

interface NoteRow {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string | null;
  is_favorite: number;
  folder: string | null;
  folder_id: number | null;
  created_at: Date;
  updated_at: Date;
}

interface GenerateNoteRequest {
  prompt: string;
  folder?: string | null;
  folder_id?: number | null;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface AiGeneratedNote {
  title: string;
  content: string;
}

export default defineEventHandler(async (event): Promise<Note> => {
  // Authenticate user
  const userId = await requireAuth(event);
  const body = await readBody<GenerateNoteRequest>(event);

  // Validate input
  if (!body.prompt || body.prompt.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'Prompt is required'
    });
  }

  const config = useRuntimeConfig();
  const openRouterApiKey = config.openRouterApiKey;

  if (!openRouterApiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key is not configured'
    });
  }

  try {
    // Call OpenRouter API with google/gemini-2.5-flash model
    const openRouterResponse = await $fetch<OpenRouterResponse>('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Markdown Notes App' // Optional: Your app name
      },
      body: {
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that generates well-structured notes. You must respond ONLY with valid JSON.

CRITICAL: Your response must be valid, parseable JSON. Follow these rules strictly:
1. Return ONLY a JSON object with "title" and "content" fields
2. Escape all special characters properly (quotes, backslashes, newlines)
3. Use proper JSON string escaping for the content field
4. Do not include any text before or after the JSON object
5. The content field must be HTML (not Markdown)

Response format:
{
  "title": "A concise, descriptive title (max 100 characters)",
  "content": "Well-structured HTML content with proper semantic tags like <h1>, <h2>, <p>, <ul>, <ol>, <strong>, <em>, <code>, etc."
}

Generate the content as clean, semantic HTML that can be rendered directly in a rich text editor. Use appropriate HTML tags for structure and formatting.`
          },
          {
            role: 'user',
            content: body.prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }
    });

    // Extract the generated content
    const generatedContent = openRouterResponse.choices[0]?.message?.content;

    if (!generatedContent) {
      throw createError({
        statusCode: 500,
        message: 'Failed to generate note content'
      });
    }

    // Parse the JSON response
    let aiNote: AiGeneratedNote;
    try {
      aiNote = JSON.parse(generatedContent);
      
      // Validate the response structure
      if (!aiNote.title || !aiNote.content) {
        throw new Error('Invalid AI response structure');
      }
      
      // Ensure title is not too long
      if (aiNote.title.length > 100) {
        aiNote.title = aiNote.title.substring(0, 97) + '...';
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', generatedContent);
      
      // Fallback: use the prompt as title and raw content
      aiNote = {
        title: body.prompt.substring(0, 100),
        content: generatedContent
      };
    }

    const title = aiNote.title;
    const content = aiNote.content;

    // Generate UUID for the new note
    const noteId = randomUUID();

    // Insert note with UUID
    await executeQuery<ResultSetHeader>(
      'INSERT INTO notes (id, user_id, title, content, tags, is_favorite, folder, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        noteId,
        userId,
        title,
        content,
        null, // No tags initially
        false,
        body.folder || null,
        body.folder_id ?? null
      ]
    );

    // Fetch created note
    const rows = await executeQuery<NoteRow[]>(
      'SELECT * FROM notes WHERE id = ?',
      [noteId]
    );

    const row = rows[0];
    if (!row) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create note'
      });
    }

    // Transform to Note object
    const note: Note = {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      tags: parseJsonField<string[]>(row.tags),
      is_favorite: Boolean(row.is_favorite),
      folder: row.folder,
      folder_id: row.folder_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    return note;
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('AI note generation error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to generate note with AI'
    });
  }
});

