import type { UserLoginDto, UserWithPassword, User, AuthResponse } from '../../../models';
import { executeQuery, parseJsonField } from '../../utils/db';
import { comparePassword } from '../../utils/auth';
import { generateToken } from '../../utils/jwt';

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const body = await readBody<UserLoginDto>(event);

  // Validate input
  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    });
  }

  try {
    // Fetch user with password and temporary password info
    const users = await executeQuery<Array<UserWithPassword & { 
      folder_order: string | null;
      temporary_password: string | null;
      temporary_password_expires_at: Date | null;
      profile_picture_url: string | null;
    }>>(
      'SELECT id, email, name, profile_picture_url, password_hash, temporary_password, temporary_password_expires_at, folder_order, created_at, updated_at FROM users WHERE email = ?',
      [body.email]
    );

    const userWithPassword = users[0];
    
    if (!userWithPassword) {
      throw createError({
        statusCode: 401,
        message: 'Invalid email or password'
      });
    }

    let isValidPassword = false;
    let isTemporaryPassword = false;

    // First, check if user is trying to login with temporary password
    if (userWithPassword.temporary_password && userWithPassword.temporary_password_expires_at) {
      const now = new Date();
      const expiresAt = new Date(userWithPassword.temporary_password_expires_at);
      
      // Check if temporary password is still valid
      if (now < expiresAt) {
        isValidPassword = await comparePassword(
          body.password,
          userWithPassword.temporary_password
        );
        
        if (isValidPassword) {
          isTemporaryPassword = true;
          
          // Update main password to temporary password and clear temp fields
          // This makes the temporary password the user's actual password until they change it
          await executeQuery(
            'UPDATE users SET password_hash = ?, temporary_password = NULL, temporary_password_expires_at = NULL WHERE id = ?',
            [userWithPassword.temporary_password, userWithPassword.id]
          );
        }
      }
    }

    // If not temporary password, check regular password
    if (!isValidPassword) {
      isValidPassword = await comparePassword(
        body.password,
        userWithPassword.password_hash
      );
    }

    if (!isValidPassword) {
      throw createError({
        statusCode: 401,
        message: 'Invalid email or password'
      });
    }

    // Remove password_hash from response and parse folder_order
    const user: User = {
      id: userWithPassword.id,
      email: userWithPassword.email,
      name: userWithPassword.name,
      profile_picture_url: userWithPassword.profile_picture_url,
      folder_order: parseJsonField<string[]>(userWithPassword.folder_order),
      created_at: userWithPassword.created_at,
      updated_at: userWithPassword.updated_at
    };

    // Generate JWT token with flag if they logged in with temp password
    const token = generateToken(user);

    return {
      user,
      token,
      usedTemporaryPassword: isTemporaryPassword
    };
  } catch (error: unknown) {
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Login error:', error);
    throw createError({
      statusCode: 500,
      message: 'Login failed'
    });
  }
});

