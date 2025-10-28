export interface NoteTemplate {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  content: string;
  category?: 'productivity' | 'personal' | 'learning' | 'health' | 'other';
}

