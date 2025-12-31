export interface Page {
  id: string;
  user_id: number;
  title: string;
  content: string | null;
  tags: string[] | null;
  is_favorite: boolean;
  folder: string | null; // Legacy field, kept for backward compatibility
  section_id: number | null;
  created_at: string | Date;
  updated_at: string | Date;
  modified_by_id?: number;
  modified_by_name?: string;
  created_by_name?: string;
}

export interface CreatePageDto {
  title: string;
  content: string;
  tags?: string[];
  section_id?: number | null;
}

export interface UpdatePageDto {
  title?: string;
  content?: string;
  tags?: string[];
  is_favorite?: boolean;
  section_id?: number | null;
}

export interface PageFilters {
  search?: string;
  section_id?: number | null;
  tags?: string[];
}

