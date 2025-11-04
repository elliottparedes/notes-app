import { requireAuth } from '~/server/utils/auth';
import { executeQuery } from '~/server/utils/db';
import { getBaseUrl } from '~/server/utils/url';

interface PublishedNoteRow {
  id: number;
  note_id: string;
  share_id: string;
  owner_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  note_title: string;
  note_updated_at: Date;
}

interface PublishedFolderRow {
  id: number;
  folder_id: number;
  share_id: string;
  owner_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  folder_name: string;
}

interface PublishedSpaceRow {
  id: number;
  space_id: number;
  share_id: string;
  owner_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  space_name: string;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);

  try {
    // Get all published notes
    const publishedNotes = await executeQuery<PublishedNoteRow[]>(`
      SELECT pn.*, n.title as note_title, n.updated_at as note_updated_at
      FROM published_notes pn
      INNER JOIN notes n ON pn.note_id = n.id
      WHERE pn.owner_id = ? AND pn.is_active = TRUE
      ORDER BY pn.updated_at DESC
    `, [userId]);

    // Get all published folders
    const publishedFolders = await executeQuery<PublishedFolderRow[]>(`
      SELECT pf.*, f.name as folder_name
      FROM published_folders pf
      INNER JOIN folders f ON pf.folder_id = f.id
      WHERE pf.owner_id = ? AND pf.is_active = TRUE
      ORDER BY pf.updated_at DESC
    `, [userId]);

    // Get all published spaces
    const publishedSpaces = await executeQuery<PublishedSpaceRow[]>(`
      SELECT ps.*, s.name as space_name
      FROM published_spaces ps
      INNER JOIN spaces s ON ps.space_id = s.id
      WHERE ps.owner_id = ? AND ps.is_active = TRUE
      ORDER BY ps.updated_at DESC
    `, [userId]);

    const baseUrl = getBaseUrl(event);

    return {
      notes: publishedNotes.map(pn => ({
        id: pn.id,
        note_id: pn.note_id,
        share_id: pn.share_id,
        title: pn.note_title,
        share_url: `${baseUrl}/p/${pn.share_id}`,
        published_at: pn.created_at,
        updated_at: pn.note_updated_at
      })),
      folders: publishedFolders.map(pf => ({
        id: pf.id,
        folder_id: pf.folder_id,
        share_id: pf.share_id,
        name: pf.folder_name,
        share_url: `${baseUrl}/p/folder/${pf.share_id}`,
        published_at: pf.created_at,
        updated_at: pf.updated_at
      })),
      spaces: publishedSpaces.map(ps => ({
        id: ps.id,
        space_id: ps.space_id,
        share_id: ps.share_id,
        name: ps.space_name,
        share_url: `${baseUrl}/p/space/${ps.share_id}`,
        published_at: ps.created_at,
        updated_at: ps.updated_at
      }))
    };
  } catch (error: any) {
    console.error('Error fetching published content:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch published content'
    });
  }
});

