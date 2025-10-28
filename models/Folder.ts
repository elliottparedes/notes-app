export interface Folder {
  id: number;
  user_id: number;
  name: string;
  parent_id: number | null;
  created_at: Date;
  updated_at: Date;
  children?: Folder[];
}

export interface CreateFolderDto {
  name: string;
  parent_id?: number | null;
}

export interface UpdateFolderDto {
  name?: string;
  parent_id?: number | null;
}

