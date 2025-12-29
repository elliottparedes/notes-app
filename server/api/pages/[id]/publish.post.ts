import { executeQuery } from '~/server/utils/db';
import { requireAuth } from '~/server/utils/auth';
import { getBaseUrl } from '~/server/utils/url';
import type { PublishResponse } from '~/models';
import { randomUUID } from 'crypto';

interface NoteOwnerRow {
  user_id: number;
}

interface PublishedRow {
  share_id: string;
  created_at: Date;
}

export default defineEventHandler(async (event): Promise<PublishResponse> => {
  try {
    const userId = await requireAuth(event);
    const noteId = getRouterParam(event, 'id');

    if (!noteId) {
      throw createError({
        statusCode: 400,
        message: 'Note ID is required'
      });
    }

    // Verify note ownership and check parent publish status
    const noteResults = await executeQuery<Array<{ user_id: number; section_id: number | null }>>(
      'SELECT user_id, section_id FROM pages WHERE id = ?',
      [noteId]
    );

    const note = noteResults[0];

    if (!note || note.user_id !== userId) {
      throw createError({
        statusCode: 403,
        message: 'Not authorized to publish this note'
      });
    }

    // Check if parent folder or space is published (warn user)
    let parentPublished = false;
    if (note.section_id) {
      const publishedFolderResults = await executeQuery<Array<{ share_id: string }>>(
        'SELECT share_id FROM published_folders WHERE section_id = ? AND owner_id = ? AND is_active = TRUE',
        [note.section_id, userId]
      );

      if (publishedFolderResults.length > 0) {
        parentPublished = true;
      } else {
        // Check parent space
        const folderResults = await executeQuery<Array<{ notebook_id: number }>>(
          'SELECT notebook_id FROM sections WHERE id = ?',
          [note.section_id]
        );

        const folder = folderResults[0];
        if (folder && folder.notebook_id) {
          const publishedSpaceResults = await executeQuery<Array<{ share_id: string }>>(
            'SELECT share_id FROM published_spaces WHERE notebook_id = ? AND owner_id = ? AND is_active = TRUE',
            [folder.notebook_id, userId]
          );

          if (publishedSpaceResults.length > 0) {
            parentPublished = true;
          }
        }
      }
    }

    // Check if already published
    const existing = await executeQuery<PublishedRow[]>(
      'SELECT share_id, created_at FROM published_pages WHERE page_id = ? AND owner_id = ?',
      [noteId, userId]
    );

    let shareId: string;
    let publishedAt: Date;

    if (existing.length > 0) {
      // Reactivate if inactive
      await executeQuery(
        'UPDATE published_pages SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE page_id = ? AND owner_id = ?',
        [noteId, userId]
      );
      shareId = existing[0].share_id;
      publishedAt = existing[0].created_at;
    } else {
      // Create new publish entry
      shareId = randomUUID();
      await executeQuery(
        'INSERT INTO published_pages (page_id, share_id, owner_id, is_active) VALUES (?, ?, ?, TRUE)',
        [noteId, shareId, userId]
      );
      const newPublishResults = await executeQuery<PublishedRow[]>(
        'SELECT created_at FROM published_pages WHERE share_id = ?',
        [shareId]
      );
      publishedAt = newPublishResults[0].created_at;
    }

    const baseUrl = getBaseUrl(event);
    const shareUrl = `${baseUrl}/p/${shareId}`;

    return {
      share_id: shareId,
      share_url: shareUrl,
      published_at: publishedAt
    };
  } catch (error: any) {
    console.error('Error publishing note:', error);
    
    // If it's already a createError, rethrow it
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to publish note'
    });
  }
});

