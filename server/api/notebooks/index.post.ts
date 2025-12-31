import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { logCreate } from '~/server/utils/history-log';
import type { CreateNotebookDto, Space } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<CreateNotebookDto>(event);
  
  // Validation
  if (!body.name || body.name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Space name is required'
    });
  }
  
  try {
    // Check if space with same name already exists for this user
    const existing = await executeQuery<any[]>(`
      SELECT id FROM notebooks 
      WHERE user_id = ? AND name = ?
    `, [userId, body.name.trim()]);

    if (existing.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A space with this name already exists'
      });
    }

    // Create the space
    const result: any = await executeQuery(`
      INSERT INTO notebooks (user_id, name, color, icon, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, [userId, body.name.trim(), body.color || null, body.icon || null]);

    // Fetch the created space
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id, name, color, icon, created_at, updated_at
      FROM notebooks
      WHERE id = ?
    `, [result.insertId]);
    
    const space = spaces[0];

    // Get user's name for history logging
    const userRows = await executeQuery<Array<{ name: string }>>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userRows[0]?.name || 'Unknown User';

    // Log creation to history (fire and forget)
    logCreate('notebook', String(space.id), userId, userName, userId, {
      name: space.name,
      color: space.color,
      icon: space.icon
    }).catch(err => console.error('History log error:', err));

    return space;
  } catch (error: any) {
    console.error('Error creating space:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create space'
    });
  }
});

