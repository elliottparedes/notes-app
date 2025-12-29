export interface KanbanCard {
  id: number;
  user_id: number;
  title: string;
  content: string | null;
  status: string;
  card_order: number;
  section_id: number | null;
  notebook_id: number | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface CreateKanbanCardDto {
  title: string;
  content?: string | null;
  status: string;
  card_order?: number;
  section_id?: number | null;
  notebook_id?: number | null;
}

export interface UpdateKanbanCardDto {
  title?: string;
  content?: string | null;
  status?: string;
  card_order?: number;
}
