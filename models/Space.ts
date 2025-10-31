export interface Space {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSpaceDto {
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateSpaceDto {
  name?: string;
  color?: string | null;
  icon?: string | null;
}

