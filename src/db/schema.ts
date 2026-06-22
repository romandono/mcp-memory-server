import { getDatabase } from './init.js';
import {
  Project,
  SddEntry,
  Task,
  Classification,
  AuditLogEntry,
  DesignDecision,
  EntryRelationship,
  EntryContext,
  PaginationParams,
  PaginatedResult,
  EntrySummary,
  MemoryFact,
  CompactEntry,
  CompactEntryContext,
  CompactTask,
  ProjectCompact,
} from '../types/context.js';
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

export function getAllEntries(paramsPg?: PaginationParams): PaginatedResult<SddEntry> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();
  const total = (db.prepare('SELECT COUNT(*) as count FROM sdd_entries').get() as any).count;

  let sql = 'SELECT * FROM sdd_entries ORDER BY created_at ASC';
  const params: any[] = [];
  if (limit) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const rows = db.prepare(sql).all(...params) as any[];
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

export function getTasksByEntry(entryId: string): Task[] {
  return getDatabase().prepare('SELECT * FROM tasks WHERE sdd_entry_id = ? ORDER BY created_at ASC').all(entryId) as Task[];
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
  const decisions = getDesignDecisions(entryId);
  const relationships = getEntryRelationships(entryId);
  return { entry, decisions, relationships };
}

// ---- COMPACT MEMORY ----

export function upsertEntrySummary(summary: EntrySummary): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO entry_summaries (entry_id, summary_short, summary_dense, keywords, source_hash, version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(entry_id) DO UPDATE SET
      summary_short = excluded.summary_short,
      summary_dense = excluded.summary_dense,
      keywords = excluded.keywords,
      source_hash = excluded.source_hash,
      version = excluded.version,
      updated_at = excluded.updated_at
  `).run(
    summary.entry_id,
    summary.summary_short,
    summary.summary_dense,
    JSON.stringify(summary.keywords),
    summary.source_hash,
    summary.version,
    summary.updated_at,
  );

  const entry = getEntry(summary.entry_id);
  if (entry) {
    db.prepare('DELETE FROM fts_entry_summaries WHERE entry_id = ?').run(summary.entry_id);
    db.prepare(`
      INSERT INTO fts_entry_summaries (entry_id, project_id, summary_short, summary_dense, keywords)
      VALUES (?, ?, ?, ?, ?)
    `).run(summary.entry_id, entry.project_id, summary.summary_short, summary.summary_dense, summary.keywords.join(' '));
  }
}

export function getEntrySummary(entryId: string): EntrySummary | null {
  const row = getDatabase().prepare('SELECT * FROM entry_summaries WHERE entry_id = ?').get(entryId) as any;
  if (!row) return null;
  return { ...row, keywords: row.keywords ? JSON.parse(row.keywords) : [] };
}

export function deleteEntrySummary(entryId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM entry_summaries WHERE entry_id = ?').run(entryId);
  db.prepare('DELETE FROM fts_entry_summaries WHERE entry_id = ?').run(entryId);
}

export function replaceEntryFacts(entryId: string, facts: MemoryFact[]): void {
  const db = getDatabase();
  const tx = db.transaction((nextFacts: MemoryFact[]) => {
    db.prepare('DELETE FROM memory_facts WHERE entry_id = ?').run(entryId);
    const stmt = db.prepare(`
      INSERT INTO memory_facts (id, project_id, entry_id, kind, subject, predicate, object, weight, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const fact of nextFacts) {
      stmt.run(fact.id, fact.project_id, fact.entry_id || null, fact.kind, fact.subject, fact.predicate, fact.object, fact.weight, fact.source, fact.created_at);
    }
  });
  tx(facts);
}

export function listMemoryFacts(filters?: { project_id?: string; entry_id?: string; kind?: string }, paramsPg?: PaginationParams): PaginatedResult<MemoryFact> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let countSql = 'SELECT COUNT(*) as count FROM memory_facts WHERE 1=1';
  let dataSql = 'SELECT * FROM memory_facts WHERE 1=1';
  const countParams: any[] = [];
  const dataParams: any[] = [];

  if (filters?.project_id) {
    countSql += ' AND project_id = ?';
    dataSql += ' AND project_id = ?';
    countParams.push(filters.project_id);
    dataParams.push(filters.project_id);
  }
  if (filters?.entry_id) {
    countSql += ' AND entry_id = ?';
    dataSql += ' AND entry_id = ?';
    countParams.push(filters.entry_id);
    dataParams.push(filters.entry_id);
  }
  if (filters?.kind) {
    countSql += ' AND kind = ?';
    dataSql += ' AND kind = ?';
    countParams.push(filters.kind);
    dataParams.push(filters.kind);
  }

  const total = (db.prepare(countSql).get(...countParams) as any).count;
  dataSql += ' ORDER BY created_at ASC';
  if (limit) {
    dataSql += ' LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);
  }

  const data = db.prepare(dataSql).all(...dataParams) as MemoryFact[];
  return { data, total };
}

function fallbackSummary(entry: SddEntry): EntrySummary {
  return {
    entry_id: entry.id,
    summary_short: entry.title,
    summary_dense: `sec:${entry.section}\nst:${entry.status}\ntitle:${entry.title}`,
    keywords: [],
    source_hash: '',
    version: 1,
    updated_at: entry.updated_at,
  };
}

export function getCompactEntry(entryId: string): CompactEntry | null {
  const entry = getEntry(entryId);
  if (!entry) return null;
  const summary = getEntrySummary(entryId) || fallbackSummary(entry);
  return {
    id: entry.id,
    project_id: entry.project_id,
    section: entry.section,
    status: entry.status,
    title: entry.title,
    summary_short: summary.summary_short,
    summary_dense: summary.summary_dense,
    keywords: summary.keywords,
  };
}

export function getCompactEntriesByIds(entryIds: string[]): CompactEntry[] {
  return entryIds.map(id => getCompactEntry(id)).filter((entry): entry is CompactEntry => entry !== null);
}

export function getCompactEntryContext(entryId: string): CompactEntryContext | null {
  const entry = getCompactEntry(entryId);
  if (!entry) return null;
  const decisions = getDesignDecisions(entryId);
  const relationships = getEntryRelationships(entryId);
  const { data: facts } = listMemoryFacts({ entry_id: entryId });
  return { entry, decisions, relationships, facts };
}

export function searchCompactEntries(query: string, projectId?: string, paramsPg?: PaginationParams): PaginatedResult<CompactEntry> {
  const { limit, offset } = parsePagination(paramsPg || {});
  const db = getDatabase();

  let ftsQuery: string;
  try {
    ftsQuery = toFtsQuery(query);
  } catch {
    ftsQuery = query;
  }

  let countSql = 'SELECT COUNT(*) as count FROM fts_entry_summaries WHERE fts_entry_summaries MATCH ?';
  let dataSql = `
    SELECT entry_id FROM fts_entry_summaries
    WHERE fts_entry_summaries MATCH ?
  `;
  const countParams: any[] = [ftsQuery];
  const dataParams: any[] = [ftsQuery];

  if (projectId) {
    countSql += ' AND project_id = ?';
    dataSql += ' AND project_id = ?';
    countParams.push(projectId);
    dataParams.push(projectId);
  }

  const total = (db.prepare(countSql).get(...countParams) as any).count;
  dataSql += ' ORDER BY rank';
  if (limit) {
    dataSql += ' LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);
  }

  const rows = db.prepare(dataSql).all(...dataParams) as { entry_id: string }[];
  const data = rows.map(row => getCompactEntry(row.entry_id)).filter((entry): entry is CompactEntry => entry !== null);

  if (data.length > 0 || total > 0) {
    return { total, data };
  }

  const base = projectId ? searchEntries(projectId, query, paramsPg) : searchAllEntries(query, paramsPg);
  return {
    total: base.total,
    data: base.data.map(entry => getCompactEntry(entry.id) || {
      id: entry.id,
      project_id: entry.project_id,
      section: entry.section,
      status: entry.status,
      title: entry.title,
      summary_short: entry.title,
      summary_dense: entry.content,
      keywords: [],
    }),
  };
}

export function getProjectCompact(projectId: string, paramsPg?: { entryLimit?: number; taskLimit?: number }): ProjectCompact | null {
  const project = getProject(projectId);
  if (!project) return null;
  const { data: entries } = getProjectEntries(projectId, undefined, paramsPg?.entryLimit ? { page: 1, limit: paramsPg.entryLimit } : undefined);
  const { data: tasks } = getProjectTasks(projectId, undefined, paramsPg?.taskLimit ? { page: 1, limit: paramsPg.taskLimit } : undefined);
  const classifications = getClassifications('project', projectId);

  return {
    project,
    entries: entries.map(entry => getCompactEntry(entry.id) || {
      id: entry.id,
      project_id: entry.project_id,
      section: entry.section,
      status: entry.status,
      title: entry.title,
      summary_short: entry.title,
      summary_dense: entry.content,
      keywords: [],
    }),
    tasks: tasks.map(task => ({
      id: task.id,
      project_id: task.project_id,
      sdd_entry_id: task.sdd_entry_id,
      title: task.title,
      status: task.status,
      priority: task.priority,
    } as CompactTask)),
    classifications,
  };
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
