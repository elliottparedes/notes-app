import { executeQuery, parseJsonField } from '~/server/utils/db';
import type { PublishedNoteWithDetails } from '~/models';

interface PublishedNoteRow {
  id: number;
  note_id: string;
  share_id: string;
  owner_id: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

interface NoteDetailsRow {
  title: string;
  content: string | null;
  updated_at: Date;
  tags: string | null;
}

interface UserDetailsRow {
  name: string | null;
  email: string;
}

export default defineEventHandler(async (event): Promise<PublishedNoteWithDetails> => {
  const shareId = getRouterParam(event, 'shareId');

  if (!shareId) {
    throw createError({
      statusCode: 400,
      message: 'Share ID is required'
    });
  }

  // Get published note
  const [published] = await executeQuery<PublishedNoteRow[]>(
    'SELECT * FROM published_notes WHERE share_id = ? AND is_active = TRUE',
    [shareId]
  );

  if (!published) {
    throw createError({
      statusCode: 404,
      message: 'Published note not found or has been unpublished'
    });
  }

  // Get note details
  const [note] = await executeQuery<NoteDetailsRow[]>(
    'SELECT title, content, updated_at, tags FROM notes WHERE id = ?',
    [published.note_id]
  );

  if (!note) {
    throw createError({
      statusCode: 404,
      message: 'Note not found'
    });
  }

  // Get owner details
  const [owner] = await executeQuery<UserDetailsRow[]>(
    'SELECT name, email FROM users WHERE id = ?',
    [published.owner_id]
  );

  if (!owner) {
    throw createError({
      statusCode: 404,
      message: 'Owner not found'
    });
  }

  return {
    id: published.id,
    note_id: published.note_id,
    share_id: published.share_id,
    owner_id: published.owner_id,
    is_active: Boolean(published.is_active),
    created_at: published.created_at,
    updated_at: published.updated_at,
    note_title: note.title,
    note_content: note.content,
    note_updated_at: note.updated_at,
    owner_name: owner.name,
    owner_email: owner.email
  };
});

