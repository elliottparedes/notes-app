export interface Folder {
  id: number;
  user_id: number;
  space_id: number;
  name: string;
  icon: string | null;
  parent_id: number | null; // Always null now, but kept for backward compatibility
  created_at: Date;
  updated_at: Date;
}

export interface CreateSectionDto {
  name: string;
  icon?: string | null;
  parent_id?: number | null;
  space_id?: number;
}

export interface UpdateSectionDto {
  name?: string;
  icon?: string | null;
  parent_id?: number | null;
  space_id?: number;
}

