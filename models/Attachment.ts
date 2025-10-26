export interface Attachment {
  id: number;
  note_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: Date;
}

export interface CreateAttachmentDto {
  note_id: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
}

