export interface Folder {
  id: number;
  user_id: number;
  space_id: number;
  name: string;
  parent_id: number | null; // Always null now, but kept for backward compatibility
  created_at: Date;
  updated_at: Date;
}

export interface CreateFolderDto {
  name: string;
  parent_id?: number | null;
  space_id?: number;
}

export interface UpdateFolderDto {
  name?: string;
  parent_id?: number | null;
  space_id?: number;
}

