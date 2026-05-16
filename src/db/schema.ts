import { getDatabase } from './init.js';
import { Project, SddEntry, Task, Classification } from '../types/context.js';

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

export function getAllProjects(): Project[] {
  return getDatabase().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
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

export function getProjectEntries(projectId: string, section?: string): SddEntry[] {
  let sql = 'SELECT * FROM sdd_entries WHERE project_id = ?';
  const params: any[] = [projectId];
  if (section) { sql += ' AND section = ?'; params.push(section); }
  sql += ' ORDER BY created_at ASC';
  const rows = getDatabase().prepare(sql).all(...params) as any[];
  return rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
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

export function searchEntries(projectId: string, query: string): SddEntry[] {
  const term = `%${query}%`;
  const rows = getDatabase().prepare(`
    SELECT * FROM sdd_entries WHERE project_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY created_at ASC
  `).all(projectId, term, term) as any[];
  return rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
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

export function getProjectTasks(projectId: string, entryId?: string): Task[] {
  let sql = 'SELECT * FROM tasks WHERE project_id = ?';
  const params: any[] = [projectId];
  if (entryId) { sql += ' AND sdd_entry_id = ?'; params.push(entryId); }
  sql += ' ORDER BY created_at ASC';
  return getDatabase().prepare(sql).all(...params) as Task[];
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
