export type ProjectStatus = 'active' | 'archived' | 'completed';
export type SddSection = 'plan' | 'design' | 'tasks' | 'general';
export type EntryStatus = 'draft' | 'review' | 'done';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ClassifiableType = 'project' | 'entry' | 'task';
export type AuditAction = 'created' | 'updated' | 'deleted';
export type AuditEntityType = 'entry' | 'task';

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

export interface AuditLogEntry {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  changes: string;
  project_id: string;
  timestamp: string;
}

export type RelationshipType = 'depends_on' | 'implements' | 'related_to' | 'supersedes';
export type ResponseView = 'full' | 'summary' | 'compact';
export type ResponseFormat = 'json' | 'toon-r' | 'toon-d';

export interface DesignDecision {
  id: string;
  entry_id: string;
  decision: string;
  rationale: string;
  alternatives_considered?: string;
  created_at: string;
}

export interface EntryRelationship {
  id: string;
  source_entry_id: string;
  target_entry_id: string;
  relationship_type: RelationshipType;
  created_at: string;
}

export interface EntryContext {
  entry: SddEntry;
  decisions: DesignDecision[];
  relationships: EntryRelationship[];
}

export interface EntrySummary {
  entry_id: string;
  summary_short: string;
  summary_dense: string;
  keywords: string[];
  source_hash: string;
  version: number;
  updated_at: string;
}

export interface MemoryFact {
  id: string;
  project_id: string;
  entry_id?: string;
  kind: string;
  subject: string;
  predicate: string;
  object: string;
  weight: number;
  source: string;
  created_at: string;
}

export interface CompactEntry {
  id: string;
  project_id: string;
  section: SddSection;
  status: EntryStatus;
  title: string;
  summary_short: string;
  summary_dense: string;
  keywords: string[];
}

export interface CompactTask {
  id: string;
  project_id: string;
  sdd_entry_id?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface CompactEntryContext {
  entry: CompactEntry;
  decisions: DesignDecision[];
  relationships: EntryRelationship[];
  facts: MemoryFact[];
}

export interface ProjectCompact {
  project: Project;
  entries: CompactEntry[];
  tasks: CompactTask[];
  classifications: Classification[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}
