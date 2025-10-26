export interface Note {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  folder: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNoteDto {
  title: string;
  content?: string;
  tags?: string[];
  is_favorite?: boolean;
  folder?: string | null | undefined;
}

export interface UpdateNoteDto {
  title?: string;
  content?: string;
  tags?: string[];
  is_favorite?: boolean;
  folder?: string | null | undefined;
}

export interface NoteFilters {
  search?: string;
  folder?: string;
  tags?: string[];
}

