import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { getBaseUrl } from '~/server/utils/url';
import type { PublishResponse } from '~/models';
import { randomUUID } from 'crypto';

interface FolderOwnerRow {
  user_id: number;
}

interface PublishedRow {
  share_id: string;
  created_at: Date;
}

export default defineEventHandler(async (event): Promise<PublishResponse> => {
  try {
    const userId = await requireAuth(event);
    const folderId = parseInt(getRouterParam(event, 'id') || '0');

    if (!folderId) {
      throw createError({
        statusCode: 400,
        message: 'Folder ID is required'
      });
    }

    // Verify folder ownership
    const folderResults = await executeQuery<FolderOwnerRow[]>(
      'SELECT user_id FROM sections WHERE id = ?',
      [folderId]
    );

    const folder = folderResults[0];

    if (!folder || folder.user_id !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized to publish this folder'
      });
    }

    // Check if already published
    const existing = await executeQuery<PublishedRow[]>(
      'SELECT share_id, created_at FROM published_sections WHERE section_id = ? AND owner_id = ?',
      [folderId, userId]
    );

    let shareId: string;
    let publishedAt: Date;

    if (existing.length > 0) {
      // Reactivate if inactive
      await executeQuery(
        'UPDATE published_sections SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE section_id = ? AND owner_id = ?',
        [folderId, userId]
      );
      shareId = existing[0].share_id;
      publishedAt = existing[0].created_at;
    } else {
      // Create new publish entry
      shareId = randomUUID();
      await executeQuery(
        'INSERT INTO published_sections (section_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
        [folderId, shareId, userId]
      );
      const newPublishResults = await executeQuery<PublishedRow[]>(
        'SELECT created_at FROM published_sections WHERE share_id = ?',
        [shareId]
      );
      publishedAt = newPublishResults[0].created_at;
    }

    // Auto-publish all notes in this folder
    const notesInFolder = await executeQuery<Array<{ id: string }>>(
      'SELECT id FROM pages WHERE section_id = ? AND user_id = ?',
      [folderId, userId]
    );

    for (const note of notesInFolder) {
      // Check if note is already published
      const existingNoteResults = await executeQuery<Array<{ share_id: string }>>(
        'SELECT share_id FROM published_notes WHERE page_id = ? AND owner_id = ?',
        [note.id, userId]
      );

      if (existingNoteResults.length > 0) {
        // Reactivate if inactive
        await executeQuery(
          'UPDATE published_notes SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND owner_id = ?',
          [note.id, userId]
        );
      } else {
        // Create new publish entry for note
        const noteShareId = randomUUID();
        await executeQuery(
          'INSERT INTO published_notes (page_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
          [note.id, noteShareId, userId]
        );
      }
    }


    const baseUrl = getBaseUrl(event);
    const shareUrl = `${baseUrl}/p/folder/${shareId}`;

    return {
      share_id: shareId,
      share_url: shareUrl,
      published_at: publishedAt
    };
  } catch (error: any) {
    console.error('Error publishing folder:', error);
    
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to publish folder'
    });
  }
});

