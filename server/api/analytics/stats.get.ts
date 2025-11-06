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
      'SELECT COUNT(*) as count FROM notes WHERE user_id = ?',
      [userId]
    );
    const totalNotes = totalNotesResult[0]?.count || 0;

    // Total words (approximate)
    const totalWordsResult = await executeQuery<Array<{ total_length: number }>>(
      `SELECT COALESCE(SUM(CHAR_LENGTH(COALESCE(content, ''))), 0) as total_length 
       FROM notes WHERE user_id = ?`,
      [userId]
    );
    const totalWords = totalWordsResult[0]?.total_length || 0;

    // Notes this week
    const notesThisWeekResult = await executeQuery<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM notes 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [userId]
    );
    const notesThisWeek = notesThisWeekResult[0]?.count || 0;

    // Notes this month
    const notesThisMonthResult = await executeQuery<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM notes 
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [userId]
    );
    const notesThisMonth = notesThisMonthResult[0]?.count || 0;

    // Most used tags
    const tags = await executeQuery<Array<{ tag: string; count: number }>>(
      `SELECT 
        JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', numbers.n, ']'))) as tag,
        COUNT(*) as count
       FROM notes
       CROSS JOIN (
         SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
         UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
       ) as numbers
       WHERE user_id = ? 
         AND tags IS NOT NULL 
         AND JSON_EXTRACT(tags, CONCAT('$[', numbers.n, ']')) IS NOT NULL
       GROUP BY tag
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );

    // Notes by day (last period days)
    const notesByDay = await executeQuery<Array<{ date: string; count: number }>>(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM notes
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

