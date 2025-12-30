export interface Note {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  folder: string | null;
  folder_id: number | null;
  created_at: string | Date;
  updated_at: string | Date;
  modified_by_id?: number;
  modified_by_name?: string;
}

export interface CreatePageDto {
  title: string;
  content: string;
  tags?: string[];
  folder_id?: number | null;
}

export interface UpdatePageDto {
  title?: string;
  content?: string;
  tags?: string[];
  is_favorite?: boolean;
  folder?: string | null;
  folder_id?: number | null;
}

export interface PageFilters {
  search?: string;
  folder?: string; // Legacy
  folder_id?: number | null; // New
  tags?: string[];
}

