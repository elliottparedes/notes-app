import { executeQuery } from '../../../utils/db';
import { requireAuth } from '../../../utils/auth';
import type { ShareNoteDto, SharedNote } from '~/models';

interface UserRow {
  id: number;
  email: string;
  name: string | null;
}

interface NoteOwnerRow {
  user_id: number;
}

interface ShareRow {
  id: number;
  note_id: string;
  owner_id: number;
  shared_with_user_id: number;
  permission: 'viewer' | 'editor';
  created_at: Date;
  updated_at: Date;
}

export default defineEventHandler(async (event): Promise<SharedNote> => {
  const userId = await requireAuth(event);
  const noteId = getRouterParam(event, 'id');
  const body = await readBody<ShareNoteDto>(event);

  if (!noteId || !body.user_email) {
    throw createError({
      statusCode: 400,
      message: 'Note ID and user email required'
    });
  }

  // Verify note ownership or edit permission
  const [note] = await executeQuery<NoteOwnerRow[]>(
    `SELECT n.user_id 
     FROM notes n
     LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = ?
     WHERE n.id = ? AND (n.user_id = ? OR (sn.permission = 'editor' AND sn.shared_with_user_id = ?))`,
    [userId, noteId, userId, userId]
  );

  if (!note || note.user_id !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to share this note'
    });
  }

  // Find user by email
  const [targetUser] = await executeQuery<UserRow[]>(
    'SELECT id, email, name FROM users WHERE email = ?',
    [body.user_email]
  );

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found with that email'
    });
  }

  if (targetUser.id === userId) {
    throw createError({
      statusCode: 400,
      message: 'Cannot share note with yourself'
    });
  }

  // Create or update share
  await executeQuery(
    `INSERT INTO shared_notes (note_id, owner_id, shared_with_user_id, permission)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE permission = VALUES(permission), updated_at = CURRENT_TIMESTAMP`,
    [noteId, userId, targetUser.id, body.permission || 'editor']
  );

  // Return the created/updated share
  const [share] = await executeQuery<ShareRow[]>(
    'SELECT * FROM shared_notes WHERE note_id = ? AND shared_with_user_id = ?',
    [noteId, targetUser.id]
  );

  return share;
});

