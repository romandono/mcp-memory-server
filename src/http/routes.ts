import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  createProject, getProject, getAllProjects, updateProject, deleteProject,
  createEntry, getEntry, getProjectEntries, updateEntry, deleteEntry, searchEntries, searchAllEntries,
  createTask, getTask, getProjectTasks, updateTask, deleteTask,
  addClassification, getClassifications, getAuditLog,
  addDesignDecision, addEntryRelationship, getEntryContext,
} from '../db/schema.js';
import { getDbPath } from '../db/init.js';
import { Project, SddEntry, Task, Classification, DesignDecision, EntryRelationship } from '../types/context.js';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Utility]
 *     responses:
 *       200:
 *         description: Server is up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- PROJECTS ----

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: List all projects
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 projects: { type: array, items: { $ref: '#/components/schemas/Project' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/api/projects', (req: Request, res: Response) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const { data, total } = getAllProjects(page || limit ? { page, limit } : undefined);
  const result: any = { success: true, projects: data };
  if (page || limit) {
    const pageNum = page || 1;
    const limitNum = limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  res.json(result);
});

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Project created
 *       400:
 *         description: Invalid input
 */
router.post('/api/projects', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ success: false, message: 'name is required' }); return; }

  const id = randomUUID();
  const now = new Date().toISOString();
  const project: Project = { id, name, description, status: 'active', created_at: now, updated_at: now };
  createProject(project);
  res.status(201).json({ success: true, id, message: `Project "${name}" created` });
});

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project details with entries and tasks
 *       404:
 *         description: Project not found
 */
router.get('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const project = getProject(id);
  if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

  const { data: entries } = getProjectEntries(id);
  const { data: tasks } = getProjectTasks(id);
  const classifications = getClassifications('project', id);
  res.json({ success: true, project, entries, tasks, classifications });
});

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [active, archived, completed] }
 *     responses:
 *       200:
 *         description: Project updated
 *       404:
 *         description: Project not found
 */
router.put('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!getProject(id)) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
  updateProject(id, req.body);
  res.json({ success: true, message: 'Project updated' });
});

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project deleted
 *       404:
 *         description: Project not found
 */
router.delete('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!getProject(id)) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
  deleteProject(id);
  res.json({ success: true, message: 'Project deleted' });
});

// ---- SDD ENTRIES ----

/**
 * @swagger
 * /api/projects/{pid}/entries:
 *   get:
 *     summary: List entries in a project
 *     tags: [Entries]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: section
 *         schema: { type: string, enum: [plan, design, tasks, general] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of entries
 */
router.get('/api/projects/:pid/entries', (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const section = req.query.section as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const { data, total } = getProjectEntries(pid, section, page || limit ? { page, limit } : undefined);
  const result: any = { success: true, count: data.length, entries: data };
  if (page || limit) {
    const pageNum = page || 1;
    const limitNum = limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  res.json(result);
});

/**
 * @swagger
 * /api/projects/{pid}/entries:
 *   post:
 *     summary: Create entry in project
 *     tags: [Entries]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [section, title]
 *             properties:
 *               section: { type: string, enum: [plan, design, tasks, general] }
 *               title: { type: string }
 *               content: { type: string }
 *               status: { type: string, enum: [draft, review, done] }
 *               parent_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Entry created
 */
router.post('/api/projects/:pid/entries', (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  if (!getProject(pid)) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

  const { section, title, content, status, parent_id } = req.body;
  if (!section || !title) { res.status(400).json({ success: false, message: 'section and title are required' }); return; }

  const id = randomUUID();
  const now = new Date().toISOString();
  const entry: SddEntry = { id, project_id: pid, section, title, content: content || '', status: status || 'draft', parent_id, created_at: now, updated_at: now };
  createEntry(entry);
  res.status(201).json({ success: true, id, message: `Entry created in ${section}` });
});

/**
 * @swagger
 * /api/entries/search:
 *   get:
 *     summary: Global search of entries
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/api/entries/search', (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) { res.status(400).json({ success: false, message: 'query param q is required' }); return; }
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const { data, total } = searchAllEntries(query, page || limit ? { page, limit } : undefined);
  const result: any = { success: true, count: data.length, results: data };
  if (page || limit) {
    const pageNum = page || 1;
    const limitNum = limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  res.json(result);
});

/**
 * @swagger
 * /api/projects/{pid}/entries/search:
 *   get:
 *     summary: Search entries within a project
 *     tags: [Search]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/api/projects/:pid/entries/search', (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const query = req.query.q as string;
  if (!query) { res.status(400).json({ success: false, message: 'query param q is required' }); return; }
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const { data, total } = searchEntries(pid, query, page || limit ? { page, limit } : undefined);
  const result: any = { success: true, count: data.length, results: data };
  if (page || limit) {
    const pageNum = page || 1;
    const limitNum = limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  res.json(result);
});

/**
 * @swagger
 * /api/entries/{eid}/context:
 *   get:
 *     summary: Get full context for an entry
 *     tags: [Context]
 *     parameters:
 *       - in: path
 *         name: eid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry context (decisions, relationships)
 */
router.get('/api/entries/:eid/context', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  const ctx = getEntryContext(eid);
  if (!ctx) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  res.json({ success: true, context: ctx });
});

/**
 * @swagger
 * /api/entries/{eid}/decisions:
 *   post:
 *     summary: Record a design decision
 *     tags: [Context]
 *     parameters:
 *       - in: path
 *         name: eid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision, rationale]
 *             properties:
 *               decision: { type: string }
 *               rationale: { type: string }
 *               alternatives_considered: { type: string }
 *     responses:
 *       201:
 *         description: Decision recorded
 */
router.post('/api/entries/:eid/decisions', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  if (!getEntry(eid)) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  const { decision, rationale, alternatives_considered } = req.body;
  if (!decision || !rationale) {
    res.status(400).json({ success: false, message: 'decision and rationale required' });
    return;
  }
  const dd: DesignDecision = {
    id: randomUUID(), entry_id: eid, decision, rationale,
    alternatives_considered, created_at: new Date().toISOString(),
  };
  addDesignDecision(dd);
  res.status(201).json({ success: true, id: dd.id, message: `Decision "${decision}" recorded` });
});

/**
 * @swagger
 * /api/entries/{eid}/relationships:
 *   post:
 *     summary: Relate two entries
 *     tags: [Context]
 *     parameters:
 *       - in: path
 *         name: eid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [target_entry_id, relationship_type]
 *             properties:
 *               target_entry_id: { type: string, format: uuid }
 *               relationship_type: { type: string, enum: [depends_on, implements, related_to, supersedes] }
 *     responses:
 *       201:
 *         description: Relationship created
 */
router.post('/api/entries/:eid/relationships', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  if (!getEntry(eid)) { res.status(404).json({ success: false, message: 'Source entry not found' }); return; }
  const { target_entry_id, relationship_type } = req.body;
  if (!target_entry_id || !relationship_type) {
    res.status(400).json({ success: false, message: 'target_entry_id and relationship_type required' });
    return;
  }
  if (!getEntry(target_entry_id)) { res.status(404).json({ success: false, message: 'Target entry not found' }); return; }
  const rel: EntryRelationship = {
    id: randomUUID(), source_entry_id: eid, target_entry_id,
    relationship_type, created_at: new Date().toISOString(),
  };
  addEntryRelationship(rel);
  res.status(201).json({ success: true, id: rel.id, message: `Relationship "${relationship_type}" created` });
});

/**
 * @swagger
 * /api/projects/{pid}/entries/{eid}:
 *   get:
 *     summary: Get entry details
 *     tags: [Entries]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry details
 */
router.get('/api/projects/:pid/entries/:eid', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  const entry = getEntry(eid);
  if (!entry) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  const classifications = getClassifications('entry', eid);
  res.json({ success: true, entry, classifications });
});

/**
 * @swagger
 * /api/projects/{pid}/entries/{eid}:
 *   put:
 *     summary: Update entry
 *     tags: [Entries]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               status: { type: string, enum: [draft, review, done] }
 *               section: { type: string, enum: [plan, design, tasks, general] }
 *     responses:
 *       200:
 *         description: Entry updated
 */
router.put('/api/projects/:pid/entries/:eid', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  if (!getEntry(eid)) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  updateEntry(eid, req.body);
  res.json({ success: true, message: 'Entry updated' });
});

/**
 * @swagger
 * /api/projects/{pid}/entries/{eid}:
 *   delete:
 *     summary: Delete entry
 *     tags: [Entries]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: eid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry deleted
 */
router.delete('/api/projects/:pid/entries/:eid', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  if (!getEntry(eid)) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  deleteEntry(eid);
  res.json({ success: true, message: 'Entry deleted' });
});

// ---- TASKS ----

/**
 * @swagger
 * /api/projects/{pid}/tasks:
 *   get:
 *     summary: List tasks in a project
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entry_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of tasks
 */
router.get('/api/projects/:pid/tasks', (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const entryId = req.query.entry_id as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const { data, total } = getProjectTasks(pid, entryId, page || limit ? { page, limit } : undefined);
  const result: any = { success: true, count: data.length, tasks: data };
  if (page || limit) {
    const pageNum = page || 1;
    const limitNum = limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  res.json(result);
});

/**
 * @swagger
 * /api/projects/{pid}/tasks:
 *   post:
 *     summary: Create task in project
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               priority: { type: string, enum: [low, medium, high, critical] }
 *               sdd_entry_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Task created
 */
router.post('/api/projects/:pid/tasks', (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  if (!getProject(pid)) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

  const { sdd_entry_id, title, description, priority } = req.body;
  if (!title) { res.status(400).json({ success: false, message: 'title is required' }); return; }

  const id = randomUUID();
  const now = new Date().toISOString();
  const task: Task = { id, project_id: pid, sdd_entry_id, title, description, status: 'pending', priority: priority || 'medium', created_at: now, updated_at: now };
  createTask(task);
  res.status(201).json({ success: true, id, message: `Task "${title}" created` });
});

/**
 * @swagger
 * /api/projects/{pid}/tasks/{tid}:
 *   put:
 *     summary: Update task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: tid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [pending, in_progress, completed, cancelled] }
 *               priority: { type: string, enum: [low, medium, high, critical] }
 *     responses:
 *       200:
 *         description: Task updated
 */
router.put('/api/projects/:pid/tasks/:tid', (req: Request, res: Response) => {
  const tid = req.params.tid as string;
  if (!getTask(tid)) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
  updateTask(tid, req.body);
  res.json({ success: true, message: 'Task updated' });
});

/**
 * @swagger
 * /api/projects/{pid}/tasks/{tid}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: tid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Task deleted
 */
router.delete('/api/projects/:pid/tasks/:tid', (req: Request, res: Response) => {
  const tid = req.params.tid as string;
  if (!getTask(tid)) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
  deleteTask(tid);
  res.json({ success: true, message: 'Task deleted' });
});

// ---- DATABASE DOWNLOAD ----

/**
 * @swagger
 * /api/db/download:
 *   get:
 *     summary: Download the SQLite database file
 *     tags: [Utility]
 *     responses:
 *       200:
 *         description: SQLite file
 *         content:
 *           application/x-sqlite3:
 *             schema: { type: string, format: binary }
 */
router.get('/api/db/download', (_req: Request, res: Response) => {
  const dbPath = getDbPath();
  const filename = path.basename(dbPath);
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = fs.createReadStream(dbPath);
  stream.pipe(res);
});

// ---- AUDIT LOG ----

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Get audit logs
 *     tags: [Audit]
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema: { type: string, enum: [entry, task] }
 *       - in: query
 *         name: entity_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: project_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Audit logs
 */
router.get('/api/audit', (req: Request, res: Response) => {
  const entity_type = req.query.entity_type as string | undefined;
  const entity_id = req.query.entity_id as string | undefined;
  const project_id = req.query.project_id as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const { data, total } = getAuditLog(
    { entity_type, entity_id, project_id },
    page || limit ? { page, limit } : undefined,
  );
  const result: any = { success: true, count: data.length, entries: data };
  if (page || limit) {
    const pageNum = page || 1;
    const limitNum = limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  res.json(result);
});

// ---- CLASSIFICATIONS ----

/**
 * @swagger
 * /api/classify:
 *   post:
 *     summary: Add classification to an entity
 *     tags: [Utility]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classifiable_type, classifiable_id, tag, confidence]
 *             properties:
 *               classifiable_type: { type: string, enum: [project, entry, task] }
 *               classifiable_id: { type: string, format: uuid }
 *               tag: { type: string }
 *               confidence: { type: number, minimum: 0, maximum: 1 }
 *     responses:
 *       201:
 *         description: Classification added
 */
router.post('/api/classify', (req: Request, res: Response) => {
  const { classifiable_type, classifiable_id, tag, confidence } = req.body;
  if (!classifiable_type || !classifiable_id || !tag || confidence === undefined) {
    res.status(400).json({ success: false, message: 'classifiable_type, classifiable_id, tag, confidence required' });
    return;
  }
  const c: Classification = {
    id: randomUUID(), classifiable_type, classifiable_id, tag, confidence,
    created_at: new Date().toISOString(),
  };
  addClassification(c);
  res.status(201).json({ success: true, classification: c });
});

export default router;
