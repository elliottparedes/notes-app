export interface SharedNote {
  id: number;
  page_id: string;
  owner_id: number;
  shared_with_user_id: number;
  permission: 'viewer' | 'editor';
  created_at: Date;
  updated_at: Date;
}

export interface SharedNoteWithDetails extends SharedNote {
  note_title: string;
  note_updated_at: Date;
  owner_name: string | null;
  owner_email: string;
  shared_with_name: string | null;
  shared_with_email: string;
  is_owned_by_me?: boolean; // Helper field to identify ownership
}

export interface ShareNoteDto {
  page_id: string;
  user_email: string;
  permission: 'viewer' | 'editor';
}

export interface UpdateShareDto {
  permission: 'viewer' | 'editor';
}

