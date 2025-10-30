import { z } from 'zod';
import { hashPassword } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { verifyToken } from '~/server/utils/jwt';

const forceResetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

// Emergency endpoint for users who can't access their account due to password issues
export default defineEventHandler(async (event) => {
  try {
    // Get authorization token
    const authHeader = getHeader(event, 'authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
      throw createError({
        statusCode: 401,
        message: 'Invalid token'
      });
    }

    const body = await readBody(event);
    const { newPassword } = forceResetPasswordSchema.parse(body);

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Force update password without checking current password
    await executeQuery(
      `UPDATE users 
       SET password_hash = ?, 
           temporary_password = NULL, 
           temporary_password_expires_at = NULL 
       WHERE id = ?`,
      [hashedNewPassword, decoded.userId]
    );

    return {
      success: true,
      message: 'Password reset successfully'
    };
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: error.errors[0]?.message || 'Invalid input'
      });
    }

    if (error.statusCode) {
      throw error;
    }

    console.error('Force reset password error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to reset password'
    });
  }
});


