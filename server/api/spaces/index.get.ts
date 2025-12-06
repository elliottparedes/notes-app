import { requireAuth } from '~/server/utils/auth';
import { executeQuery, parseJsonField } from '~/server/utils/db';
import type { Space } from '~/models';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  
  try {
    // Fetch spaces
    const spaces = await executeQuery<Space[]>(`
      SELECT id, user_id, name, color, icon, created_at, updated_at
      FROM spaces
      WHERE user_id = ?
    `, [userId]);

    // Get order
    const userResults = await executeQuery<Array<{ space_order: string | null }>>(
      'SELECT space_order FROM users WHERE id = ?',
      [userId]
    );
    
    const order = parseJsonField<number[]>(userResults[0]?.space_order) || [];
    
    // Sort spaces
    if (order.length > 0) {
      spaces.sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        
        // If both are in order list, sort by index
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        
        // If one is not in order list (e.g. new space), put it at the end
        if (indexA !== -1 && indexB === -1) return -1;
        if (indexA === -1 && indexB !== -1) return 1;
        
        // If neither is in order list, sort by created_at (fallback)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    } else {
      // Default sort if no order is set
      spaces.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return spaces;
  } catch (error) {
    console.error('Error fetching spaces:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch spaces'
    });
  }
});
