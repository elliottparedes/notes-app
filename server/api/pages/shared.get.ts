import { executeQuery } from '../../utils/db';
import { requireAuth } from '../../utils/auth';
import type { SharedNoteWithDetails } from '~/models';

interface SharedNoteRow {
  id: number;
  page_id: string;
  owner_id: number;
  shared_with_user_id: number;
  permission: 'viewer' | 'editor';
  created_at: Date;
  updated_at: Date;
  note_title: string;
  note_updated_at: Date;
  owner_name: string | null;
  owner_email: string;
  shared_with_name: string | null;
  shared_with_email: string;
}

export default defineEventHandler(async (event): Promise<SharedNoteWithDetails[]> => {
  const userId = await requireAuth(event);

  try {
    // Fetch all shares where user is either the owner or the recipient
    const shares = await executeQuery<SharedNoteRow[]>(
      `SELECT
        sn.*,
        p.title as note_title,
        p.updated_at as note_updated_at,
        owner.name as owner_name,
        owner.email as owner_email,
        shared.name as shared_with_name,
        shared.email as shared_with_email
      FROM shared_pages sn
      JOIN pages p ON sn.page_id = p.id
      JOIN users owner ON sn.owner_id = owner.id
      JOIN users shared ON sn.shared_with_user_id = shared.id
      WHERE sn.owner_id = ? OR sn.shared_with_user_id = ?
      ORDER BY p.updated_at DESC`,
      [userId, userId]
    );

    // Add helper field to identify ownership
    const sharesWithDetails: SharedNoteWithDetails[] = shares.map(share => ({
      ...share,
      is_owned_by_me: share.owner_id === userId
    }));

    return sharesWithDetails;
  } catch (error: unknown) {
    console.error('Fetch shared notes error:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch shared notes'
    });
  }
});

