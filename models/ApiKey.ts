export interface ApiKey {
  id: number;
  user_id: number;
  key_name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  request_count: number;
  last_used_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateApiKeyDto {
  key_name: string;
  scopes?: string[];
  expires_at?: Date | null;
}

export interface UpdateApiKeyDto {
  key_name?: string;
  is_active?: boolean;
  scopes?: string[];
}

export interface ApiKeyResponse {
  id: number;
  key_name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
}

export interface ApiKeyWithToken extends ApiKeyResponse {
  key: string; // Full key - only returned once on creation
}
