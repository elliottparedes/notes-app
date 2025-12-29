import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';

interface AnalyticsStats {
  total_notes: number;
  total_words: number;
  notes_this_week: number;
  notes_this_month: number;
  most_used_tags: Array<{ tag: string; count: number }>;
  notes_by_day: Array<{ date: string; count: number }>;
  copilot_usage: number;
}

export default defineEventHandler(async (event): Promise<AnalyticsStats> => {
  const userId = await requireAuth(event);
  const query = getQuery(event);
  const period = (query.period as string) || '30'; // days

  try {
    // Total notes
    const totalNotesResult = await executeQuery<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM pages WHERE user_id = ?',
      [userId]
    );
    const totalNotes = totalNotesResult[0]?.count || 0;

    // Total words (approximate)
    const totalWordsResult = await executeQuery<Array<{ total_length: number }>>(
      `SELECT COALESCE(SUM(CHAR_LENGTH(COALESCE(content, ''))), 0) as total_length 
       FROM pages WHERE user_id = ?`,
      [userId]
    );
    const totalWords = totalWordsResult[0]?.total_length || 0;

    // Notes this week
    const notesThisWeekResult = await executeQuery<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM pages 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    );
    const notesThisWeek = notesThisWeekResult[0]?.count || 0;

    // Notes this month
    const notesThisMonthResult = await executeQuery<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM pages 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    );
    const notesThisMonth = notesThisMonthResult[0]?.count || 0;

    // Most used tags - use a safer approach that handles invalid JSON
    let tags: Array<{ tag: string; count: number }> = [];
    try {
      // First, get all notes with tags and parse them in Node.js to avoid MySQL JSON parsing issues
      const notesWithTags = await executeQuery<Array<{ tags: string | null }>>(
        'SELECT tags FROM pages WHERE user_id = ? AND tags IS NOT NULL',
        [userId]
      );
      
      // Parse tags and count them
      const tagCounts = new Map<string, number>();
      for (const note of notesWithTags) {
        if (!note.tags) continue;
        try {
          let parsedTags: string[] = [];
          
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(note.tags);
            if (Array.isArray(parsed)) {
              parsedTags = parsed;
            }
          } catch (parseError) {
            // If JSON parsing fails, check if it's a comma-separated string
            if (typeof note.tags === 'string' && note.tags.includes(',')) {
              // Convert comma-separated string to array
              parsedTags = note.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            } else {
              // Skip if it's not a valid format
              continue;
            }
          }
          
          // Process tags
          for (const tag of parsedTags) {
            if (typeof tag === 'string' && tag.trim().length > 0) {
              const cleanTag = tag.trim();
              tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
            }
          }
        } catch (e) {
          // Skip invalid tags silently
          // Only log if it's not a JSON parse error (which we already handle above)
          if (!(e instanceof SyntaxError)) {
            console.warn('Error processing tags:', e);
          }
        }
      }
      
      // Convert to array and sort
      tags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (error) {
      console.error('Error processing tags:', error);
      // Return empty array if there's an error
      tags = [];
    }

    // Notes by day (last period days)
    const notesByDay = await executeQuery<Array<{ date: string; count: number }>>(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM pages
       WHERE user_id = ? 
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [userId, period]
    );

    return {
      total_notes: totalNotes,
      total_words: Math.floor(totalWords / 5), // Approximate: 5 chars per word
      notes_this_week: notesThisWeek,
      notes_this_month: notesThisMonth,
      most_used_tags: tags.map(t => ({ tag: t.tag, count: t.count })),
      notes_by_day: notesByDay.map(n => {
        const dateStr = typeof n.date === 'string' ? n.date : String(n.date);
        return {
          date: dateStr.split('T')[0], // Ensure we only get the date part
          count: n.count,
        };
      }),
      copilot_usage: 0,
    };
  } catch (error: any) {
    console.error('Analytics stats error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch analytics stats'
    });
  }
});

