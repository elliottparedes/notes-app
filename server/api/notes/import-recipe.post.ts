import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import type { Note } from '~/models';

interface ImportRecipeRequest {
  url: string;
  folder_id?: number | null;
}

interface RecipeData {
  name: string;
  image?: string;
  ingredients: string[];
  instructions: string[];
  description?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: string;
}

// Extract JSON-LD from HTML
function extractJsonLd(html: string): RecipeData | null {
  try {
    // Find all JSON-LD script tags
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const matches = html.matchAll(jsonLdRegex);

    for (const match of matches) {
      try {
        const jsonString = match[1];
        const data = JSON.parse(jsonString);

        // Handle both single objects and arrays of objects
        const recipes = Array.isArray(data) ? data : [data];
        
        for (const item of recipes) {
          // Check if this is a Recipe schema
          const type = item['@type'];
          if (type && (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')))) {
            const recipe: RecipeData = {
              name: item.name || 'Untitled Recipe',
              image: item.image?.url || item.image?.[0]?.url || item.image || undefined,
              ingredients: [],
              instructions: [],
              description: item.description,
              prepTime: item.prepTime,
              cookTime: item.cookTime,
              totalTime: item.totalTime,
              servings: item.recipeYield
            };

            // Extract ingredients
            if (item.recipeIngredient && Array.isArray(item.recipeIngredient)) {
              recipe.ingredients = item.recipeIngredient;
            }

            // Extract instructions
            if (item.recipeInstructions) {
              if (Array.isArray(item.recipeInstructions)) {
                recipe.instructions = item.recipeInstructions.map((step: any) => {
                  if (typeof step === 'string') return step;
                  if (step.text) return step.text;
                  if (step.itemListElement) {
                    return step.itemListElement.map((s: any) => s.text || '').join(' ');
                  }
                  return '';
                }).filter(Boolean);
              } else if (typeof item.recipeInstructions === 'string') {
                recipe.instructions = [item.recipeInstructions];
              }
            }

            // Only return if we have at least ingredients or instructions
            if (recipe.ingredients.length > 0 || recipe.instructions.length > 0) {
              return recipe;
            }
          }
        }
      } catch (parseError) {
        // Continue to next match
        continue;
      }
    }
  } catch (error) {
    console.error('Error extracting JSON-LD:', error);
  }
  
  return null;
}

// Use AI to parse HTML when JSON-LD is not available
async function parseRecipeWithAI(html: string, url: string, apiKey: string): Promise<RecipeData> {
  // Clean up HTML to reduce token usage
  // Remove script tags, style tags, and excessive whitespace
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit HTML length to avoid token limits (increased to 50k characters for better context)
  if (cleanHtml.length > 150000) {
    cleanHtml = cleanHtml.substring(0, 150000) + '...';
  }

  const prompt = `HTML Content:
${cleanHtml}

Extract ONLY the recipe information as valid JSON. No explanations, no markdown, just the JSON object.`;

  try {
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
            content: `You are a recipe extraction tool. You MUST respond with ONLY valid JSON in this exact format:
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["step 1", "step 2"],
  "image": "image URL or empty string",
  "prepTime": "preparation time or empty string",
  "cookTime": "cooking time or empty string",
  "totalTime": "total time or empty string",
  "servings": "servings or empty string"
}

CRITICAL RULES:
- Return ONLY the JSON object, no other text
- Do not include explanations, markdown, or code blocks
- All fields must be present (use empty string or empty array if not found)
- Do not wrap in backticks or code blocks`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 20000,
        response_format: { type: 'json_object' }
      }
    });

    const aiResponse = (response as any).choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // More aggressive JSON extraction
    let jsonString = aiResponse.trim();
    
    // Remove markdown code blocks
    if (jsonString.includes('```')) {
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
      }
    }
    
    // Try to find JSON object even if there's text around it
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
    
    // Remove any leading/trailing non-JSON text
    jsonString = jsonString.trim();

    console.log('[Recipe Import] Attempting to parse AI response:', jsonString.substring(0, 200) + '...');

    const recipeData = JSON.parse(jsonString) as RecipeData;
    
    // Validate that we have at least a name
    if (!recipeData.name) {
      recipeData.name = `Recipe from ${url}`;
    }

    // Clean up empty strings to undefined for optional fields
    if (recipeData.image === '') recipeData.image = undefined;
    if (recipeData.description === '') recipeData.description = undefined;
    if (recipeData.prepTime === '') recipeData.prepTime = undefined;
    if (recipeData.cookTime === '') recipeData.cookTime = undefined;
    if (recipeData.totalTime === '') recipeData.totalTime = undefined;
    if (recipeData.servings === '') recipeData.servings = undefined;

    return recipeData;
  } catch (error) {
    console.error('AI parsing error:', error);
    
    // Fallback: return a minimal recipe structure so import doesn't completely fail
    console.log('[Recipe Import] AI parsing failed, returning fallback recipe structure');
    return {
      name: `Recipe from ${url}`,
      ingredients: [],
      instructions: [],
      description: 'Could not automatically extract recipe details. Please edit this note to add the recipe manually.'
    };
  }
}

// Convert recipe data to HTML content
function recipeToHtml(recipe: RecipeData): string {
  let html = '';

  // Add image if available
  if (recipe.image) {
    html += `<p><img src="${recipe.image}" alt="${recipe.name}" style="max-width: 100%; height: auto; border-radius: 8px;" /></p>`;
  }

  // Add description
  if (recipe.description) {
    html += `<p>${recipe.description}</p>`;
  }

  // Add metadata (times, servings)
  const metadata = [];
  if (recipe.prepTime) metadata.push(`⏱️ Prep: ${recipe.prepTime}`);
  if (recipe.cookTime) metadata.push(`🔥 Cook: ${recipe.cookTime}`);
  if (recipe.totalTime) metadata.push(`⏰ Total: ${recipe.totalTime}`);
  if (recipe.servings) metadata.push(`🍽️ Servings: ${recipe.servings}`);
  
  if (metadata.length > 0) {
    html += `<p><em>${metadata.join(' • ')}</em></p>`;
  }

  // Add ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    html += '<h2>Ingredients</h2><ul>';
    recipe.ingredients.forEach(ingredient => {
      html += `<li>${ingredient}</li>`;
    });
    html += '</ul>';
  }

  // Add instructions
  if (recipe.instructions && recipe.instructions.length > 0) {
    html += '<h2>Instructions</h2><ol>';
    recipe.instructions.forEach(instruction => {
      html += `<li>${instruction}</li>`;
    });
    html += '</ol>';
  }

  return html;
}

export default defineEventHandler(async (event): Promise<Note> => {
  const userId = await requireAuth(event);
  const body = await readBody<ImportRecipeRequest>(event);

  // Validate input
  if (!body.url || body.url.trim() === '') {
    throw createError({
      statusCode: 400,
      message: 'URL is required'
    });
  }

  // Validate URL format
  try {
    new URL(body.url);
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid URL format'
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
    // Fetch the webpage
    console.log('Fetching recipe from:', body.url);
    const html = await $fetch<string>(body.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // Try to extract JSON-LD first
    console.log('Attempting to extract JSON-LD...');
    let recipeData = extractJsonLd(html);

    // If no JSON-LD found, use AI to parse the HTML
    if (!recipeData) {
      console.log('No JSON-LD found, using AI to parse HTML...');
      recipeData = await parseRecipeWithAI(html, body.url, openRouterApiKey);
    } else {
      console.log('Successfully extracted recipe from JSON-LD');
    }

    // Convert recipe data to HTML
    const content = recipeToHtml(recipeData);

    // Create the note in the database
    const noteId = crypto.randomUUID();
    const now = new Date();

    await executeQuery(
      `INSERT INTO notes (id, user_id, title, content, folder_id, is_favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [noteId, userId, recipeData.name, content, body.folder_id || null, false, now, now]
    );

    // Fetch and return the created note
    const notes = await executeQuery<Note[]>(
      'SELECT * FROM notes WHERE id = ?',
      [noteId]
    );

    if (!notes || notes.length === 0) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create note'
      });
    }

    const note = notes[0];

    return {
      ...note,
      tags: note.tags ? JSON.parse(note.tags as any) : null
    };

  } catch (error: any) {
    console.error('Recipe import error:', error);
    
    // Handle fetch errors
    if (error.statusCode === 404) {
      throw createError({
        statusCode: 404,
        message: 'Recipe page not found'
      });
    }
    
    if (error.message?.includes('fetch')) {
      throw createError({
        statusCode: 500,
        message: 'Failed to fetch recipe page. Please check the URL and try again.'
      });
    }

    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to import recipe'
    });
  }
});

