export type ProjectStatus = 'active' | 'archived' | 'completed';
export type SddSection = 'plan' | 'design' | 'tasks' | 'general';
export type EntryStatus = 'draft' | 'review' | 'done';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ClassifiableType = 'project' | 'entry' | 'task';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface SddEntry {
  id: string;
  project_id: string;
  section: SddSection;
  title: string;
  content: string;
  status: EntryStatus;
  parent_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  sdd_entry_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
}

export interface Classification {
  id: string;
  classifiable_type: ClassifiableType;
  classifiable_id: string;
  tag: string;
  confidence: number;
  created_at: string;
}
