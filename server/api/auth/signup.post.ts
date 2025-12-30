import type { UserSignupDto, UserWithPassword, User, AuthResponse } from '../../../models';
import type { ResultSetHeader } from 'mysql2';
import { executeQuery } from '../../utils/db';
import { hashPassword } from '../../utils/auth';
import { generateToken } from '../../utils/jwt';

export default defineEventHandler(async (event): Promise<AuthResponse> => {
  const body = await readBody<UserSignupDto>(event);

  // Validate input
  if (!body.email || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid email format'
    });
  }

  // Validate password length
  if (body.password.length < 6) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 6 characters long'
    });
  }

  try {
    // Check if user already exists
    const existingUsers = await executeQuery<UserWithPassword[]>(
      'SELECT id FROM users WHERE email = ?',
      [body.email]
    );

    if (existingUsers.length > 0) {
      throw createError({
        statusCode: 409,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Insert user (with user_type for existing schema)
    const result = await executeQuery<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, name, user_type) VALUES (?, ?, ?, ?)',
      [body.email, passwordHash, body.name || 'User', 'individual']
    );

    // Fetch created user
    const users = await executeQuery<User[]>(
      'SELECT id, email, name, profile_picture_url, folder_order, created_at, updated_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = users[0];
    if (!user) {
      throw createError({
        statusCode: 500,
        message: 'Failed to create user'
      });
    }
    
    // Ensure folder_order is null for new users
    user.folder_order = null;

    // Create a default "Personal" space for the new user
    try {
      await executeQuery(
        'INSERT INTO notebooks (user_id, name, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [user.id, 'Personal', null, 'user']
      );
    } catch (spaceError) {
      // Log error but don't fail signup if space creation fails
      console.error('Failed to create default space for user:', spaceError);
    }

    // Check for pending user invitations and auto-accept with bidirectional sharing
    const pendingInvites = await executeQuery<Array<{
      id: number;
      owner_id: number;
    }>>(
      'SELECT id, owner_id FROM user_invitations WHERE invited_email = ? AND status = "pending"',
      [user.email]
    );

    for (const invite of pendingInvites) {
      // Accept the invitation
      await executeQuery(
        'UPDATE user_invitations SET status = "accepted", invited_user_id = ? WHERE id = ?',
        [user.id, invite.id]
      );

      // Create reverse invitation for bidirectional sharing
      await executeQuery(
        `INSERT INTO user_invitations (owner_id, invited_email, invited_user_id, status)
         SELECT ?, email, ?, 'accepted'
         FROM users WHERE id = ?
         ON DUPLICATE KEY UPDATE status = 'accepted', invited_user_id = ?`,
        [user.id, invite.owner_id, invite.owner_id, invite.owner_id]
      );
    }

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

    console.error('Signup error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to create user'
    });
  }
});

