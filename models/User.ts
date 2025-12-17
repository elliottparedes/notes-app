export interface User {
  id: number;
  email: string;
  name: string | null;
  profile_picture_url: string | null;
  folder_order: string[] | null;
  storage_used: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface UserSignupDto {
  email: string;
  password: string;
  name?: string;
}

export interface UserLoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  usedTemporaryPassword?: boolean;
}

