import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import type { PublishResponse } from '~/models';
import { randomUUID } from 'crypto';

interface SpaceOwnerRow {
  user_id: number;
}

interface PublishedRow {
  share_id: string;
  created_at: Date;
}

export default defineEventHandler(async (event): Promise<PublishResponse> => {
  try {
    const userId = await requireAuth(event);
    const spaceId = parseInt(getRouterParam(event, 'id') || '0');

    if (!spaceId) {
      throw createError({
        statusCode: 400,
        message: 'Space ID is required'
      });
    }

    // Verify space ownership
    const spaceResults = await executeQuery<SpaceOwnerRow[]>(
      'SELECT user_id FROM spaces WHERE id = ?',
      [spaceId]
    );

    const space = spaceResults[0];

    if (!space || space.user_id !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized to publish this space'
      });
    }

    // Check if already published
    const existing = await executeQuery<PublishedRow[]>(
      'SELECT share_id, created_at FROM published_spaces WHERE space_id = ? AND owner_id = ?',
      [spaceId, userId]
    );

    let shareId: string;
    let publishedAt: Date;

    if (existing.length > 0) {
      // Reactivate if inactive
      await executeQuery(
        'UPDATE published_spaces SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE space_id = ? AND owner_id = ?',
        [spaceId, userId]
      );
      shareId = existing[0].share_id;
      publishedAt = existing[0].created_at;
    } else {
      // Create new publish entry
      shareId = randomUUID();
      await executeQuery(
        'INSERT INTO published_spaces (space_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
        [spaceId, shareId, userId]
      );
      const newPublishResults = await executeQuery<PublishedRow[]>(
        'SELECT created_at FROM published_spaces WHERE share_id = ?',
        [shareId]
      );
      publishedAt = newPublishResults[0].created_at;
    }

    // Auto-publish all folders and notes in this space
    const foldersInSpace = await executeQuery<Array<{ id: number }>>(
      'SELECT id FROM folders WHERE space_id = ? AND user_id = ?',
      [spaceId, userId]
    );

    // Publish all folders recursively
    async function publishFolderRecursive(folderId: number) {
      // Check if folder is already published
      const existingFolderResults = await executeQuery<Array<{ share_id: string }>>(
        'SELECT share_id FROM published_folders WHERE folder_id = ? AND owner_id = ?',
        [folderId, userId]
      );

      if (existingFolderResults.length > 0) {
        await executeQuery(
          'UPDATE published_folders SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ? AND owner_id = ?',
          [folderId, userId]
        );
      } else {
        const folderShareId = randomUUID();
        await executeQuery(
          'INSERT INTO published_folders (folder_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
          [folderId, folderShareId, userId]
        );
      }

      // Publish all notes in this folder
      const notesInFolder = await executeQuery<Array<{ id: string }>>(
        'SELECT id FROM notes WHERE folder_id = ? AND user_id = ?',
        [folderId, userId]
      );

      for (const note of notesInFolder) {
        const existingNoteResults = await executeQuery<Array<{ share_id: string }>>(
          'SELECT share_id FROM published_notes WHERE note_id = ? AND owner_id = ?',
          [note.id, userId]
        );

        if (existingNoteResults.length > 0) {
          await executeQuery(
            'UPDATE published_notes SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE note_id = ? AND owner_id = ?',
            [note.id, userId]
          );
        } else {
          const noteShareId = randomUUID();
          await executeQuery(
            'INSERT INTO published_notes (note_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
            [note.id, noteShareId, userId]
          );
        }
      }

      // Recursively publish subfolders
      const subfolders = await executeQuery<Array<{ id: number }>>(
        'SELECT id FROM folders WHERE parent_id = ? AND user_id = ?',
        [folderId, userId]
      );

      for (const subfolder of subfolders) {
        await publishFolderRecursive(subfolder.id);
      }
    }

    // Publish all root folders in the space
    for (const folder of foldersInSpace) {
      await publishFolderRecursive(folder.id);
    }

    // Publish all notes without folders in this space
    const rootNotes = await executeQuery<Array<{ id: string }>>(
    `SELECT n.id FROM notes n
     WHERE n.folder_id IS NULL AND n.user_id = ? 
     AND NOT EXISTS (
       SELECT 1 FROM folders f WHERE f.space_id = ? AND f.user_id = ?
     )`,
    [userId, spaceId, userId]
  );

    for (const note of rootNotes) {
      const existingNoteResults = await executeQuery<Array<{ share_id: string }>>(
        'SELECT share_id FROM published_notes WHERE note_id = ? AND owner_id = ?',
        [note.id, userId]
      );

      if (existingNoteResults.length > 0) {
        await executeQuery(
          'UPDATE published_notes SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE note_id = ? AND owner_id = ?',
          [note.id, userId]
        );
      } else {
        const noteShareId = randomUUID();
        await executeQuery(
          'INSERT INTO published_notes (note_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
          [note.id, noteShareId, userId]
        );
      }
    }

    const config = useRuntimeConfig();
    const baseUrl = process.env.NUXT_PUBLIC_BASE_URL || config.public?.baseUrl || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/p/space/${shareId}`;

    return {
      share_id: shareId,
      share_url: shareUrl,
      published_at: publishedAt
    };
  } catch (error: any) {
    console.error('Error publishing space:', error);
    
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to publish space'
    });
  }
});

