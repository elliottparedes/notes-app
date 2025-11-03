import { executeQuery } from '~/server/utils/db';
import type { PublishedSpaceWithDetails, PublishedFolderWithDetails, PublishedNoteWithDetails } from '~/models';

interface PublishedSpaceRow {
  id: number;
  space_id: number;
  share_id: string;
  owner_id: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

interface SpaceDetailsRow {
  name: string;
}

interface FolderRow {
  id: number;
  name: string;
  parent_id: number | null;
}

interface NoteRow {
  id: string;
  title: string;
  content: string | null;
  updated_at: Date;
  folder_id: number | null;
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

interface PublishedFolderRow {
  id: number;
  folder_id: number;
  share_id: string;
  owner_id: number;
  is_active: number;
  created_at: Date;
}

// Helper to recursively build folder tree
async function buildFolderTree(
  folders: FolderRow[],
  publishedFolders: PublishedFolderRow[],
  publishedNotes: Map<string, PublishedNoteRow>,
  ownerId: number
): Promise<PublishedFolderWithDetails[]> {
  const folderMap = new Map<number, FolderRow>();
  const publishedFolderMap = new Map<number, PublishedFolderRow>();

  folders.forEach(f => folderMap.set(f.id, f));
  publishedFolders.forEach(pf => publishedFolderMap.set(pf.folder_id, pf));

  const rootFolders = folders.filter(f => f.parent_id === null);

  async function getFolderNotes(folderId: number): Promise<PublishedNoteWithDetails[]> {
    const notes = await executeQuery<NoteRow[]>(
      'SELECT id, title, content, updated_at, folder_id FROM notes WHERE folder_id = ? AND user_id = ?',
      [folderId, ownerId]
    );

    const publishedFolderNotes: PublishedNoteWithDetails[] = [];
    for (const note of notes) {
      const publishedNote = publishedNotes.get(note.id);
      if (publishedNote) {
        const [owner] = await executeQuery<UserDetailsRow[]>(
          'SELECT name, email FROM users WHERE id = ?',
          [ownerId]
        );

        publishedFolderNotes.push({
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
      }
    }

    return publishedFolderNotes;
  }

  async function buildFolder(folder: FolderRow): Promise<PublishedFolderWithDetails> {
    const publishedFolder = publishedFolderMap.get(folder.id)!;
    const notes = await getFolderNotes(folder.id);
    
    const children = folders.filter(f => f.parent_id === folder.id);
    const subfolders = await Promise.all(
      children.map(child => buildFolder(child))
    );

    return {
      id: publishedFolder.id,
      folder_id: folder.id,
      share_id: publishedFolder.share_id,
      owner_id: ownerId,
      is_active: Boolean(publishedFolder.is_active),
      created_at: publishedFolder.created_at,
      updated_at: publishedFolder.created_at,
      folder_name: folder.name,
      notes,
      subfolders
    };
  }

  return Promise.all(rootFolders.map(folder => buildFolder(folder)));
}

export default defineEventHandler(async (event): Promise<PublishedSpaceWithDetails> => {
  const shareId = getRouterParam(event, 'shareId');

  if (!shareId) {
    throw createError({
      statusCode: 400,
      message: 'Share ID is required'
    });
  }

  // Get published space
  const [published] = await executeQuery<PublishedSpaceRow[]>(
    'SELECT * FROM published_spaces WHERE share_id = ? AND is_active = TRUE',
    [shareId]
  );

  if (!published) {
    throw createError({
      statusCode: 404,
      message: 'Published space not found or has been unpublished'
    });
  }

  // Get space details
  const [space] = await executeQuery<SpaceDetailsRow[]>(
    'SELECT name FROM spaces WHERE id = ?',
    [published.space_id]
  );

  if (!space) {
    throw createError({
      statusCode: 404,
      message: 'Space not found'
    });
  }

  // Get all published notes in this space
  const allPublishedNotes = await executeQuery<PublishedNoteRow[]>(
    `SELECT pn.* FROM published_notes pn
     INNER JOIN notes n ON pn.note_id = n.id
     LEFT JOIN folders f ON n.folder_id = f.id
     WHERE pn.owner_id = ? AND pn.is_active = TRUE
     AND (f.space_id = ? OR (n.folder_id IS NULL AND EXISTS (
       SELECT 1 FROM folders WHERE space_id = ? AND user_id = ?
     )))
     OR (n.folder_id IS NULL AND NOT EXISTS (
       SELECT 1 FROM folders WHERE user_id = ? AND space_id = ?
     ))`,
    [published.owner_id, published.space_id, published.space_id, published.owner_id, published.owner_id, published.space_id]
  );

  // Actually, let's simplify - get all notes for this user and filter by space via folder
  const publishedNotesMap = new Map<string, PublishedNoteRow>();
  for (const pn of allPublishedNotes) {
    // Verify note belongs to this space
    const [note] = await executeQuery<Array<{ folder_id: number | null }>>(
      'SELECT folder_id FROM notes WHERE id = ?',
      [pn.note_id]
    );

    if (note) {
      if (note.folder_id === null) {
        // Note without folder - include it
        publishedNotesMap.set(pn.note_id, pn);
      } else {
        // Check if folder belongs to this space
        const [folder] = await executeQuery<Array<{ space_id: number }>>(
          'SELECT space_id FROM folders WHERE id = ?',
          [note.folder_id]
        );
        if (folder && folder.space_id === published.space_id) {
          publishedNotesMap.set(pn.note_id, pn);
        }
      }
    }
  }

  // Get all published folders in this space
  const publishedFoldersData = await executeQuery<PublishedFolderRow[]>(
    `SELECT pf.* FROM published_folders pf
     INNER JOIN folders f ON pf.folder_id = f.id
     WHERE pf.owner_id = ? AND pf.is_active = TRUE AND f.space_id = ?`,
    [published.owner_id, published.space_id]
  );

  // Get all folders in this space
  const allFolders = await executeQuery<FolderRow[]>(
    'SELECT id, name, parent_id FROM folders WHERE space_id = ? AND user_id = ?',
    [published.space_id, published.owner_id]
  );

  // Build folder tree
  const folders = await buildFolderTree(
    allFolders.filter(f => publishedFoldersData.some(pf => pf.folder_id === f.id)),
    publishedFoldersData,
    publishedNotesMap,
    published.owner_id
  );

  // Get notes without folders (root level notes)
  const rootNotes = await executeQuery<NoteRow[]>(
    'SELECT id, title, content, updated_at, folder_id FROM notes WHERE folder_id IS NULL AND user_id = ?',
    [published.owner_id]
  );

  const publishedRootNotes: PublishedNoteWithDetails[] = [];
  for (const note of rootNotes) {
    const publishedNote = publishedNotesMap.get(note.id);
    if (publishedNote) {
      const [owner] = await executeQuery<UserDetailsRow[]>(
        'SELECT name, email FROM users WHERE id = ?',
        [published.owner_id]
      );

      publishedRootNotes.push({
        id: publishedNote.id,
        note_id: note.id,
        share_id: publishedNote.share_id,
        owner_id: published.owner_id,
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

  return {
    id: published.id,
    space_id: published.space_id,
    share_id: published.share_id,
    owner_id: published.owner_id,
    is_active: Boolean(published.is_active),
    created_at: published.created_at,
    updated_at: published.updated_at,
    space_name: space.name,
    folders,
    notes: publishedRootNotes
  };
});

