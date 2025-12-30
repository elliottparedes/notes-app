import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody(event);

  const { email } = body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw createError({
      statusCode: 400,
      message: 'Valid email address is required'
    });
  }

  try {
    // Insert invitation (will fail if duplicate due to UNIQUE constraint)
    await executeQuery(
      `INSERT INTO user_invitations (owner_id, invited_email, status)
       VALUES (?, ?, 'pending')`,
      [userId, email.toLowerCase()]
    );

    return {
      success: true,
      message: 'Invitation sent successfully'
    };
  } catch (error: any) {
    // Check if it's a duplicate key error
    if (error.code === 'ER_DUP_ENTRY') {
      throw createError({
        statusCode: 409,
        message: 'This email has already been invited'
      });
    }

    console.error('Error creating invitation:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to send invitation'
    });
  }
});
