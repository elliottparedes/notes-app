import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';

interface AnalyticsEvent {
  event_type: string;
  event_data?: Record<string, any>;
  page_id?: string;
  section_id?: number | null;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<AnalyticsEvent>(event);

  if (!body.event_type) {
    throw createError({
      statusCode: 400,
      message: 'Event type is required'
    });
  }

  try {
    // Insert analytics event
    await executeQuery(
      `INSERT INTO analytics_events 
       (user_id, event_type, event_data, page_id, section_id, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        body.event_type,
        body.event_data ? JSON.stringify(body.event_data) : null,
        body.page_id || null,
        body.section_id || null,
      ]
    );

    return { success: true };
  } catch (error: any) {
    console.error('Analytics tracking error:', error);
    // Don't throw - analytics failures shouldn't break the app
    return { success: false };
  }
});

