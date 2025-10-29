export interface Note {
  id: string; // UUID
  user_id: number;
  title: string;
  content: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  folder: string | null; // Legacy - keep for backward compatibility
  folder_id: number | null; // New - references folders table
  created_at: Date;
  updated_at: Date;
}

export interface CreateNoteDto {
  title: string;
  content?: string;
  tags?: string[];
  is_favorite?: boolean;
  folder?: string | null | undefined; // Legacy
  folder_id?: number | null | undefined; // New
}

export interface UpdateNoteDto {
  title?: string;
  content?: string;
  tags?: string[];
  is_favorite?: boolean;
  folder?: string | null | undefined; // Legacy
  folder_id?: number | null | undefined; // New
}

export interface NoteFilters {
  search?: string;
  folder?: string; // Legacy
  folder_id?: number | null; // New
  tags?: string[];
}

