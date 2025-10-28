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
    // Fetch user with password
    const users = await executeQuery<Array<UserWithPassword & { folder_order: string | null }>>(
      'SELECT id, email, name, password_hash, folder_order, created_at, updated_at FROM users WHERE email = ?',
      [body.email]
    );

    const userWithPassword = users[0];
    
    if (!userWithPassword) {
      throw createError({
        statusCode: 401,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(
      body.password,
      userWithPassword.password_hash
    );

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
      folder_order: parseJsonField<string[]>(userWithPassword.folder_order),
      created_at: userWithPassword.created_at,
      updated_at: userWithPassword.updated_at
    };

    // Generate JWT token
    const token = generateToken(user);

    return {
      user,
      token
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

