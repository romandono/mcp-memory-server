import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  createProject, getProject, getAllProjects, updateProject, deleteProject,
  createEntry, getEntry, getProjectEntries, updateEntry, deleteEntry, searchEntries,
  createTask, getTask, getProjectTasks, updateTask, deleteTask,
  addClassification, getClassifications, removeClassification,
} from '../db/schema.js';
import { getDbPath } from '../db/init.js';
import { Project, SddEntry, Task, Classification } from '../types/context.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- PROJECTS ----

router.get('/api/projects', (_req: Request, res: Response) => {
  res.json({ success: true, projects: getAllProjects() });
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

  const entries = getProjectEntries(id);
  const tasks = getProjectTasks(id);
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
  const entries = getProjectEntries(pid, section);
  res.json({ success: true, count: entries.length, entries });
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

router.get('/api/projects/:pid/entries/search', (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const query = req.query.q as string;
  if (!query) { res.status(400).json({ success: false, message: 'query param q is required' }); return; }
  const results = searchEntries(pid, query);
  res.json({ success: true, count: results.length, results });
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
  const tasks = getProjectTasks(pid, entryId);
  res.json({ success: true, count: tasks.length, tasks });
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

router.get('/api/db/download', (req: Request, res: Response) => {
  const dbPath = getDbPath();
  const filename = path.basename(dbPath);
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = fs.createReadStream(dbPath);
  stream.pipe(res);
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
