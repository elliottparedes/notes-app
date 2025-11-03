import { executeQuery, parseJsonField } from '~/server/utils/db';
import type { PublishedFolderWithDetails, PublishedNoteWithDetails } from '~/models';

interface PublishedFolderRow {
  id: number;
  folder_id: number;
  share_id: string;
  owner_id: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

interface FolderDetailsRow {
  name: string;
  parent_id: number | null;
}

interface NoteRow {
  id: string;
  title: string;
  content: string | null;
  updated_at: Date;
  tags: string | null;
}

interface UserDetailsRow {
  name: string | null;
  email: string;
}

interface PublishedNoteRow {
  id: number;
  note_id: string;
  share_id: string;
  owner_id: number;
  is_active: number;
  created_at: Date;
}

// Helper to recursively get folder structure
async function getFolderTree(
  folderId: number,
  ownerId: number,
  parentPublishedNoteIds: Set<string> = new Set()
): Promise<PublishedFolderWithDetails> {
  // Get folder details
  const [folder] = await executeQuery<FolderDetailsRow[]>(
    'SELECT name, parent_id FROM folders WHERE id = ? AND user_id = ?',
    [folderId, ownerId]
  );

  if (!folder) {
    throw createError({
      statusCode: 404,
      message: 'Folder not found'
    });
  }

  // Get published notes in this folder
  const notes = await executeQuery<NoteRow[]>(
    `SELECT n.id, n.title, n.content, n.updated_at, n.tags 
     FROM notes n
     INNER JOIN published_notes pn ON n.id = pn.note_id
     WHERE n.folder_id = ? AND n.user_id = ? AND pn.is_active = TRUE
     ORDER BY n.updated_at DESC`,
    [folderId, ownerId]
  );

  // Get published subfolders
  const subfoldersData = await executeQuery<Array<{ id: number }>>(
    'SELECT id FROM folders WHERE parent_id = ? AND user_id = ?',
    [folderId, ownerId]
  );

  const publishedSubfolders: PublishedFolderWithDetails[] = [];
  for (const subfolder of subfoldersData) {
    // Check if subfolder is published
    const [isPublished] = await executeQuery<PublishedFolderRow[]>(
      'SELECT * FROM published_folders WHERE folder_id = ? AND is_active = TRUE',
      [subfolder.id]
    );

    if (isPublished) {
      publishedSubfolders.push(await getFolderTree(subfolder.id, ownerId, parentPublishedNoteIds));
    }
  }

  // Get published notes with details
  const publishedNotes: PublishedNoteWithDetails[] = [];
  for (const note of notes) {
    if (!parentPublishedNoteIds.has(note.id)) {
      const [publishedNote] = await executeQuery<PublishedNoteRow[]>(
        'SELECT * FROM published_notes WHERE note_id = ? AND is_active = TRUE',
        [note.id]
      );

      if (publishedNote) {
        const [owner] = await executeQuery<UserDetailsRow[]>(
          'SELECT name, email FROM users WHERE id = ?',
          [ownerId]
        );

        publishedNotes.push({
          id: publishedNote.id,
          note_id: note.id,
          share_id: publishedNote.share_id,
          owner_id: ownerId,
          is_active: Boolean(publishedNote.is_active),
          created_at: publishedNote.created_at,
          updated_at: publishedNote.created_at,
          note_title: note.title,
          note_content: note.content,
          note_updated_at: note.updated_at,
          owner_name: owner?.name || null,
          owner_email: owner?.email || ''
        });

        parentPublishedNoteIds.add(note.id);
      }
    }
  }

  // Get the published folder record for share_id
  const [publishedFolderRecord] = await executeQuery<PublishedFolderRow[]>(
    'SELECT * FROM published_folders WHERE folder_id = ? AND is_active = TRUE',
    [folderId]
  );

  if (!publishedFolderRecord) {
    throw createError({
      statusCode: 404,
      message: 'Published folder record not found'
    });
  }

  return {
    id: publishedFolderRecord.id,
    folder_id: folderId,
    share_id: publishedFolderRecord.share_id,
    owner_id: ownerId,
    is_active: Boolean(publishedFolderRecord.is_active),
    created_at: publishedFolderRecord.created_at,
    updated_at: publishedFolderRecord.updated_at,
    folder_name: folder.name,
    notes: publishedNotes,
    subfolders: publishedSubfolders
  };
}

export default defineEventHandler(async (event): Promise<PublishedFolderWithDetails> => {
  const shareId = getRouterParam(event, 'shareId');

  if (!shareId) {
    throw createError({
      statusCode: 400,
      message: 'Share ID is required'
    });
  }

  // Get published folder
  const [published] = await executeQuery<PublishedFolderRow[]>(
    'SELECT * FROM published_folders WHERE share_id = ? AND is_active = TRUE',
    [shareId]
  );

  if (!published) {
    throw createError({
      statusCode: 404,
      message: 'Published folder not found or has been unpublished'
    });
  }

  // Get folder tree recursively
  const folderTree = await getFolderTree(published.folder_id, published.owner_id, new Set());

  return folderTree;
});

