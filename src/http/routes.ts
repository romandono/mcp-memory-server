import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  createProject, getProject, getAllProjects, updateProject, deleteProject,
  createEntry, getEntry, getProjectEntries, updateEntry, deleteEntry, searchEntries, searchAllEntries,
  createTask, getTask, getProjectTasks, updateTask, deleteTask,
  addClassification, getClassifications, getAuditLog,
} from '../db/schema.js';
import { getDbPath } from '../db/init.js';
import { Project, SddEntry, Task, Classification } from '../types/context.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- PROJECTS ----

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

router.post('/api/projects', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ success: false, message: 'name is required' }); return; }

  const id = randomUUID();
  const now = new Date().toISOString();
  const project: Project = { id, name, description, status: 'active', created_at: now, updated_at: now };
  createProject(project);
  res.status(201).json({ success: true, id, message: `Project "${name}" created` });
});

router.get('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const project = getProject(id);
  if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

  const { data: entries } = getProjectEntries(id);
  const { data: tasks } = getProjectTasks(id);
  const classifications = getClassifications('project', id);
  res.json({ success: true, project, entries, tasks, classifications });
});

router.put('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!getProject(id)) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
  updateProject(id, req.body);
  res.json({ success: true, message: 'Project updated' });
});

router.delete('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!getProject(id)) { res.status(404).json({ success: false, message: 'Project not found' }); return; }
  deleteProject(id);
  res.json({ success: true, message: 'Project deleted' });
});

// ---- SDD ENTRIES ----

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

router.get('/api/projects/:pid/entries/:eid', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  const entry = getEntry(eid);
  if (!entry) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  const classifications = getClassifications('entry', eid);
  res.json({ success: true, entry, classifications });
});

router.put('/api/projects/:pid/entries/:eid', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  if (!getEntry(eid)) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  updateEntry(eid, req.body);
  res.json({ success: true, message: 'Entry updated' });
});

router.delete('/api/projects/:pid/entries/:eid', (req: Request, res: Response) => {
  const eid = req.params.eid as string;
  if (!getEntry(eid)) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
  deleteEntry(eid);
  res.json({ success: true, message: 'Entry deleted' });
});

// ---- TASKS ----

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

router.put('/api/projects/:pid/tasks/:tid', (req: Request, res: Response) => {
  const tid = req.params.tid as string;
  if (!getTask(tid)) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
  updateTask(tid, req.body);
  res.json({ success: true, message: 'Task updated' });
});

router.delete('/api/projects/:pid/tasks/:tid', (req: Request, res: Response) => {
  const tid = req.params.tid as string;
  if (!getTask(tid)) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
  deleteTask(tid);
  res.json({ success: true, message: 'Task deleted' });
});

// ---- DATABASE DOWNLOAD ----

router.get('/api/db/download', (_req: Request, res: Response) => {
  const dbPath = getDbPath();
  const filename = path.basename(dbPath);
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = fs.createReadStream(dbPath);
  stream.pipe(res);
});

// ---- AUDIT LOG ----

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
