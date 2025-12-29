import { executeQuery, parseJsonField } from '~/server/utils/db';
import type { PublishedFolderWithDetails, PublishedNoteWithDetails } from '~/models';

interface PublishedFolderRow {
  id: number;
  section_id: number;
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
  note_order: string | null;
}

interface PublishedNoteRow {
  id: number;
  page_id: string;
  share_id: string;
  owner_id: number;
  is_active: number;
  created_at: Date;
}

// Helper to get folder with its notes (no subfolders)
async function getFolderDetails(
  folderId: number,
  ownerId: number
): Promise<PublishedFolderWithDetails> {
  // Get folder details
  const folder = await executeQuery<FolderDetailsRow[]>(
    'SELECT name, parent_id FROM sections WHERE id = ? AND user_id = ?',
    [folderId, ownerId]
  );

  if (!folder) {
    throw createError({
      statusCode: 404,
      message: 'Folder not found'
    });
  }

  // Get published notes in this folder (without ORDER BY - we'll sort by custom order)
  const notes = await executeQuery<NoteRow[]>(
    `SELECT n.id, n.title, n.content, n.updated_at, n.tags 
     FROM pages n
     INNER JOIN published_notes pn ON n.id = pn.page_id
     WHERE n.section_id = ? AND n.user_id = ? AND pn.is_active = TRUE`,
    [folderId, ownerId]
  );

  // Get user's note order preference
  let noteOrder: Record<string, string[]> = {};
  try {
    const user = await executeQuery<UserDetailsRow[]>(
      'SELECT note_order FROM users WHERE id = ?',
      [ownerId]
    );
    if (user?.note_order) {
      noteOrder = parseJsonField<Record<string, string[]>>(user.note_order) || {};
    }
  } catch (err: any) {
    // If column doesn't exist, that's okay - we'll use default sorting
    if (err.code !== 'ER_BAD_FIELD_ERROR' && !err.message?.includes('Unknown column')) {
      console.error('Error fetching note_order:', err);
    }
  }

  // Apply custom order if available
  const folderKey = `folder_${folderId}`;
  const customOrder = noteOrder[folderKey];
  
  let orderedNotes: NoteRow[] = [];
  if (customOrder && customOrder.length > 0) {
    // Sort by custom order
    const noteMap = new Map(notes.map(n => [n.id, n]));
    const ordered: NoteRow[] = [];
    
    // Add notes in custom order
    for (const noteId of customOrder) {
      const note = noteMap.get(noteId);
      if (note) {
        ordered.push(note);
        noteMap.delete(noteId);
      }
    }
    
    // Add remaining notes (not in custom order) sorted by updated_at
    const remaining = Array.from(noteMap.values()).sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    orderedNotes = [...ordered, ...remaining];
  } else {
    // No custom order - sort by updated_at descending
    orderedNotes = notes.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  // Get published notes with details
  const publishedNotes: PublishedNoteWithDetails[] = [];
  for (const note of orderedNotes) {
    const publishedNote = await executeQuery<PublishedNoteRow[]>(
      'SELECT * FROM published_notes WHERE page_id = ? AND is_active = TRUE',
      [note.id]
    );

    if (publishedNote) {
      const owner = await executeQuery<UserDetailsRow[]>(
        'SELECT name, email FROM users WHERE id = ?',
        [ownerId]
      );

      publishedNotes.push({
        id: publishedNote.id,
        page_id: note.id,
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
    }
  }

  // Get the published folder record for share_id
  const publishedFolderRecord = await executeQuery<PublishedFolderRow[]>(
    'SELECT * FROM published_folders WHERE section_id = ? AND is_active = TRUE',
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
    section_id: folderId,
    share_id: publishedFolderRecord.share_id,
    owner_id: ownerId,
    is_active: Boolean(publishedFolderRecord.is_active),
    created_at: publishedFolderRecord.created_at,
    updated_at: publishedFolderRecord.updated_at,
    folder_name: folder.name,
    notes: publishedNotes,
    subfolders: [] // No subfolders anymore
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
  const published = await executeQuery<PublishedFolderRow[]>(
    'SELECT * FROM published_folders WHERE share_id = ? AND is_active = TRUE',
    [shareId]
  );

  if (!published) {
    throw createError({
      statusCode: 404,
      message: 'Published folder not found or has been unpublished'
    });
  }

  // Get folder details (no subfolders)
  const folderDetails = await getFolderDetails(published.section_id, published.owner_id);

  return folderDetails;
});

