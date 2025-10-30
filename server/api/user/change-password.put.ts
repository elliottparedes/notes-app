import { z } from 'zod';
import { hashPassword, comparePassword } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { verifyToken } from '~/server/utils/jwt';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

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
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    // Get user's current password
    const users = await executeQuery<Array<{ id: string; password_hash: string }>>(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!users || users.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);

    if (!isValidPassword) {
      throw createError({
        statusCode: 400,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password and clear any temporary password
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
      message: 'Password changed successfully'
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

    console.error('Change password error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to change password'
    });
  }
});


