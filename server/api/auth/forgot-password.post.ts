import { z } from 'zod';
import { hashPassword } from '~/server/utils/auth';
import { sendPasswordResetEmail } from '~/server/utils/email';
import { executeQuery } from '~/server/utils/db';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

// Generate a random temporary password
function generateTemporaryPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { email } = forgotPasswordSchema.parse(body);

    // Check if user exists
    const users = await executeQuery<Array<{ id: string; email: string; name: string | null }>>(
      'SELECT id, email, name FROM users WHERE email = ?',
      [email]
    );

    // Always return success to prevent email enumeration attacks
    if (!users || users.length === 0) {
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.'
      };
    }

    const user = users[0];

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedTemporaryPassword = await hashPassword(temporaryPassword);

    // Set expiration time (30 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    // Update user with temporary password
    await executeQuery(
      `UPDATE users 
       SET temporary_password = ?, 
           temporary_password_expires_at = ? 
       WHERE id = ?`,
      [hashedTemporaryPassword, expiresAt, user.id]
    );

    // Send email with temporary password
    try {
      await sendPasswordResetEmail(email, temporaryPassword);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      throw createError({
        statusCode: 500,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.'
    };
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: 'Invalid email address'
      });
    }

    console.error('Forgot password error:', error);
    throw createError({
      statusCode: 500,
      message: 'An error occurred while processing your request'
    });
  }
});

