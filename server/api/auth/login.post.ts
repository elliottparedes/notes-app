import type { UserLoginDto, UserWithPassword, User, AuthResponse } from '../../../models';
import { executeQuery } from '../../utils/db';
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
    const users = await executeQuery<UserWithPassword[]>(
      'SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = ?',
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

    // Remove password_hash from response
    const user: User = {
      id: userWithPassword.id,
      email: userWithPassword.email,
      name: userWithPassword.name,
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

