export interface Attachment {
  id: number;
  note_id: string; // UUID (VARCHAR(36))
  user_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: Date;
  presigned_url?: string; // Populated when fetching attachments for download
}

export interface CreateAttachmentDto {
  note_id: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
}

export interface AttachmentWithUrl extends Attachment {
  presigned_url: string;
}

