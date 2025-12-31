export type EntityType = 'page' | 'notebook' | 'section';
export type ActionType = 'create' | 'update' | 'delete';

export interface HistoryLog {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  user_id: number;
  user_name: string;
  owner_id: number;
  action: ActionType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
}

export interface HistoryLogWithEntity extends HistoryLog {
  entity_title?: string;
}

export interface HistoryLogFilters {
  entity_type?: EntityType;
  entity_id?: string;
  user_id?: number;
  action?: ActionType;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

export interface HistoryLogResponse {
  logs: HistoryLogWithEntity[];
  total: number;
  hasMore: boolean;
}

export interface ContributingUser {
  user_id: number;
  user_name: string;
  change_count: number;
}
