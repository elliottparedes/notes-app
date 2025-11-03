export interface PublishedNote {
  id: number;
  note_id: string;
  share_id: string;
  owner_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PublishedFolder {
  id: number;
  folder_id: number;
  share_id: string;
  owner_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PublishedSpace {
  id: number;
  space_id: number;
  share_id: string;
  owner_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PublishResponse {
  share_id: string;
  share_url: string;
  published_at: Date;
}

export interface PublishedNoteWithDetails extends PublishedNote {
  note_title: string;
  note_content: string | null;
  note_updated_at: Date;
  owner_name: string | null;
  owner_email: string;
}

export interface PublishedFolderWithDetails extends PublishedFolder {
  folder_name: string;
  notes: PublishedNoteWithDetails[];
  subfolders: PublishedFolderWithDetails[];
}

export interface PublishedSpaceWithDetails extends PublishedSpace {
  space_name: string;
  folders: PublishedFolderWithDetails[];
  notes: PublishedNoteWithDetails[]; // Notes without folders
}

