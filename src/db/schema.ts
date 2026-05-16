import { getDatabase } from './init.js';
import { Project, SddEntry, Task, Classification, AuditLogEntry, FileChange, DesignDecision, EntryRelationship, EntryContext, PaginationParams, PaginatedResult } from '../types/context.js';
import { toFtsQuery } from './migrations/runner.js';

function parsePagination(params: PaginationParams): { limit: number; offset: number } {
  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 200) : 0;
  const page = params.page && params.page > 0 ? params.page : 0;
  return { limit, offset: limit > 0 ? (page - 1) * limit : 0 };
}

// ---- PROJECTS ----

export function createProject(project: Project): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO projects (id, name, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(project.id, project.name, project.description || null, project.status, project.created_at, project.updated_at);
}

export function getProject(id: string): Project | null {
  const row = getDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  return row || null;
}

export function getAllProjects(params?: PaginationParams): PaginatedResult<Project> {
  const { limit, offset } = parsePagination(params || {});
  const db = getDatabase();
  const total = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count;

  if (!limit) {
    const data = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
    return { data, total };
  }

  const data = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Project[];
  return { data, total };
}

export function updateProject(id: string, updates: Partial<Project>): void {
  const existing = getProject(id);
  if (!existing) throw new Error(`Project ${id} not found`);

  const merged = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
  getDatabase().prepare(`
    UPDATE projects SET name=?, description=?, status=?, updated_at=? WHERE id=?
  `).run(merged.name, merged.description || null, merged.status, merged.updated_at, id);
}

export function deleteProject(id: string): void {
  getDatabase().prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// ---- SDD ENTRIES ----

export function createEntry(entry: SddEntry): void {
  getDatabase().prepare(`
    INSERT INTO sdd_entries (id, project_id, section, title, content, status, parent_id, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.project_id, entry.section, entry.title, entry.content, entry.status, entry.parent_id || null,
    entry.metadata ? JSON.stringify(entry.metadata) : null, entry.created_at, entry.updated_at);
}

export function getEntry(id: string): SddEntry | null {
  const row = getDatabase().prepare('SELECT * FROM sdd_entries WHERE id = ?').get(id) as any;
  if (!row) return null;
  return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : undefined };
}

export function getProjectEntries(projectId: string, section?: string, paramsPg?: PaginationParams): PaginatedResult<SddEntry> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let countSql = 'SELECT COUNT(*) as count FROM sdd_entries WHERE project_id = ?';
  let dataSql = 'SELECT * FROM sdd_entries WHERE project_id = ?';
  const countParams: any[] = [projectId];
  const dataParams: any[] = [projectId];

  if (section) {
    countSql += ' AND section = ?';
    dataSql += ' AND section = ?';
    countParams.push(section);
    dataParams.push(section);
  }

  const total = (db.prepare(countSql).get(...countParams) as any).count;

  dataSql += ' ORDER BY created_at ASC';
  if (limit) {
    dataSql += ' LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);
  }

  const rows = db.prepare(dataSql).all(...dataParams) as any[];
  const data = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
  return { data, total };
}

export function updateEntry(id: string, updates: Partial<SddEntry>): void {
  const existing = getEntry(id);
  if (!existing) throw new Error(`Entry ${id} not found`);
  const merged = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
  getDatabase().prepare(`
    UPDATE sdd_entries SET project_id=?, section=?, title=?, content=?, status=?, parent_id=?, metadata=?, updated_at=? WHERE id=?
  `).run(merged.project_id, merged.section, merged.title, merged.content, merged.status, merged.parent_id || null,
    merged.metadata ? JSON.stringify(merged.metadata) : null, merged.updated_at, id);
}

export function deleteEntry(id: string): void {
  getDatabase().prepare('DELETE FROM sdd_entries WHERE id = ?').run(id);
}

export function searchEntries(projectId: string, query: string, paramsPg?: PaginationParams): PaginatedResult<SddEntry> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let ftsQuery: string;
  try {
    ftsQuery = toFtsQuery(query);
  } catch {
    ftsQuery = query;
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM fts_entries f
    JOIN sdd_entries s ON s.id = f.entry_id
    WHERE s.project_id = ? AND f.fts_entries MATCH ?
  `).get(projectId, ftsQuery) as any;
  const total = countResult?.count ?? 0;

  let sql = `
    SELECT s.* FROM sdd_entries s
    JOIN fts_entries f ON f.entry_id = s.id
    WHERE s.project_id = ? AND f.fts_entries MATCH ?
    ORDER BY rank
  `;
  const params: any[] = [projectId, ftsQuery];

  if (limit) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  const data = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
  return { data, total };
}

export function searchAllEntries(query: string, paramsPg?: PaginationParams): PaginatedResult<SddEntry> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let ftsQuery: string;
  try {
    ftsQuery = toFtsQuery(query);
  } catch {
    ftsQuery = query;
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM fts_entries f
    JOIN sdd_entries s ON s.id = f.entry_id
    WHERE f.fts_entries MATCH ?
  `).get(ftsQuery) as any;
  const total = countResult?.count ?? 0;

  let sql = `
    SELECT s.* FROM sdd_entries s
    JOIN fts_entries f ON f.entry_id = s.id
    WHERE f.fts_entries MATCH ?
    ORDER BY rank
  `;
  const params: any[] = [ftsQuery];

  if (limit) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  const data = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
  return { data, total };
}

// ---- TASKS ----

export function createTask(task: Task): void {
  getDatabase().prepare(`
    INSERT INTO tasks (id, project_id, sdd_entry_id, title, description, status, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.project_id, task.sdd_entry_id || null, task.title, task.description || null, task.status, task.priority, task.created_at, task.updated_at);
}

export function getTask(id: string): Task | null {
  const row = getDatabase().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row || null;
}

export function getProjectTasks(projectId: string, entryId?: string, paramsPg?: PaginationParams): PaginatedResult<Task> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let countSql = 'SELECT COUNT(*) as count FROM tasks WHERE project_id = ?';
  let dataSql = 'SELECT * FROM tasks WHERE project_id = ?';
  const countParams: any[] = [projectId];
  const dataParams: any[] = [projectId];

  if (entryId) {
    countSql += ' AND sdd_entry_id = ?';
    dataSql += ' AND sdd_entry_id = ?';
    countParams.push(entryId);
    dataParams.push(entryId);
  }

  const total = (db.prepare(countSql).get(...countParams) as any).count;

  dataSql += ' ORDER BY created_at ASC';
  if (limit) {
    dataSql += ' LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);
  }

  const data = db.prepare(dataSql).all(...dataParams) as Task[];
  return { data, total };
}

export function updateTask(id: string, updates: Partial<Task>): void {
  const existing = getTask(id);
  if (!existing) throw new Error(`Task ${id} not found`);
  const merged = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
  getDatabase().prepare(`
    UPDATE tasks SET project_id=?, sdd_entry_id=?, title=?, description=?, status=?, priority=?, updated_at=? WHERE id=?
  `).run(merged.project_id, merged.sdd_entry_id || null, merged.title, merged.description || null, merged.status, merged.priority, merged.updated_at, id);
}

export function deleteTask(id: string): void {
  getDatabase().prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// ---- AUDIT LOG ----

export function getAuditLog(filters?: { entity_type?: string; entity_id?: string; project_id?: string }, paramsPg?: PaginationParams): PaginatedResult<AuditLogEntry> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let countSql = 'SELECT COUNT(*) as count FROM audit_log WHERE 1=1';
  let dataSql = 'SELECT * FROM audit_log WHERE 1=1';
  const countParams: any[] = [];
  const dataParams: any[] = [];

  if (filters?.entity_type) {
    countSql += ' AND entity_type = ?';
    dataSql += ' AND entity_type = ?';
    countParams.push(filters.entity_type);
    dataParams.push(filters.entity_type);
  }
  if (filters?.entity_id) {
    countSql += ' AND entity_id = ?';
    dataSql += ' AND entity_id = ?';
    countParams.push(filters.entity_id);
    dataParams.push(filters.entity_id);
  }
  if (filters?.project_id) {
    countSql += ' AND project_id = ?';
    dataSql += ' AND project_id = ?';
    countParams.push(filters.project_id);
    dataParams.push(filters.project_id);
  }

  const total = (db.prepare(countSql).get(...countParams) as any).count;
  dataSql += ' ORDER BY timestamp DESC';

  if (limit) {
    dataSql += ' LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);
  }

  const data = db.prepare(dataSql).all(...dataParams) as AuditLogEntry[];
  return { data, total };
}

// ---- FILE CHANGES ----

export function addFileChange(fc: FileChange): void {
  getDatabase().prepare(`
    INSERT INTO file_changes (id, entry_id, file_path, change_type, line_start, line_end, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fc.id, fc.entry_id, fc.file_path, fc.change_type, fc.line_start || null, fc.line_end || null, fc.summary, fc.created_at);
}

export function getFileChanges(entryId: string): FileChange[] {
  return getDatabase().prepare('SELECT * FROM file_changes WHERE entry_id = ? ORDER BY created_at ASC').all(entryId) as FileChange[];
}

// ---- DESIGN DECISIONS ----

export function addDesignDecision(dd: DesignDecision): void {
  getDatabase().prepare(`
    INSERT INTO design_decisions (id, entry_id, decision, rationale, alternatives_considered, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(dd.id, dd.entry_id, dd.decision, dd.rationale, dd.alternatives_considered || null, dd.created_at);
}

export function getDesignDecisions(entryId: string): DesignDecision[] {
  return getDatabase().prepare('SELECT * FROM design_decisions WHERE entry_id = ? ORDER BY created_at ASC').all(entryId) as DesignDecision[];
}

// ---- ENTRY RELATIONSHIPS ----

export function addEntryRelationship(rel: EntryRelationship): void {
  getDatabase().prepare(`
    INSERT INTO entry_relationships (id, source_entry_id, target_entry_id, relationship_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(rel.id, rel.source_entry_id, rel.target_entry_id, rel.relationship_type, rel.created_at);
}

export function getEntryRelationships(entryId: string): EntryRelationship[] {
  return getDatabase().prepare(`
    SELECT * FROM entry_relationships WHERE source_entry_id = ? OR target_entry_id = ? ORDER BY created_at ASC
  `).all(entryId, entryId) as EntryRelationship[];
}

// ---- ENTRY CONTEXT ----

export function getEntryContext(entryId: string): EntryContext | null {
  const entry = getEntry(entryId);
  if (!entry) return null;
  const fileChanges = getFileChanges(entryId);
  const decisions = getDesignDecisions(entryId);
  const relationships = getEntryRelationships(entryId);
  return { entry, fileChanges, decisions, relationships };
}

// ---- CLASSIFICATIONS ----

export function addClassification(c: Classification): void {
  getDatabase().prepare(`
    INSERT INTO classifications (id, classifiable_type, classifiable_id, tag, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(c.id, c.classifiable_type, c.classifiable_id, c.tag, c.confidence, c.created_at);
}

export function getClassifications(type: string, id: string): Classification[] {
  return getDatabase().prepare(`
    SELECT * FROM classifications WHERE classifiable_type = ? AND classifiable_id = ? ORDER BY confidence DESC
  `).all(type, id) as Classification[];
}

export function removeClassification(id: string): void {
  getDatabase().prepare('DELETE FROM classifications WHERE id = ?').run(id);
}
