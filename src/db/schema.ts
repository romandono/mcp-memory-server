import { getDatabase } from './init.js';
import { Project, SddEntry, Task, Classification, PaginationParams, PaginatedResult } from '../types/context.js';
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
