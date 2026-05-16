import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getDatabase } from '../../src/db/init.js';
import {
  createProject, getProject, getAllProjects, updateProject, deleteProject,
  createEntry, getEntry, getProjectEntries, updateEntry, deleteEntry, searchEntries,
  createTask, getTask, getProjectTasks, updateTask, deleteTask,
  addClassification, getClassifications, removeClassification,
} from '../../src/db/schema.js';
import { Project, SddEntry, Task, Classification } from '../../src/types/context.js';

function makeProject(overrides?: Partial<Project>): Project {
  const now = new Date().toISOString();
  return {
    id: `proj-${Math.random().toString(36).slice(2)}`,
    name: 'Test Project',
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeEntry(projectId: string, overrides?: Partial<SddEntry>): SddEntry {
  const now = new Date().toISOString();
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    project_id: projectId,
    section: 'plan',
    title: 'Test Entry',
    content: 'Test content',
    status: 'draft',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeTask(projectId: string, overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    project_id: projectId,
    title: 'Test Task',
    status: 'pending',
    priority: 'medium',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

beforeEach(() => {
  initializeDatabase(':memory:');
});

afterEach(() => {
  closeDatabase();
});

// ---- PROJECTS ----

describe('Projects', () => {
  it('creates and retrieves a project', () => {
    const project = makeProject({ name: 'My Project' });
    createProject(project);
    const retrieved = getProject(project.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('My Project');
    expect(retrieved!.status).toBe('active');
  });

  it('returns null for non-existent project', () => {
    expect(getProject('nonexistent')).toBeNull();
  });

  it('lists all projects ordered by created_at desc', () => {
    const p1 = makeProject({ name: 'First', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' });
    const p2 = makeProject({ name: 'Second', created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z' });
    createProject(p1);
    createProject(p2);
    const { data, total } = getAllProjects();
    expect(data).toHaveLength(2);
    expect(total).toBe(2);
    expect(data[0].name).toBe('Second');
  });

  it('updates a project', () => {
    const project = makeProject({ name: 'Original' });
    createProject(project);
    updateProject(project.id, { name: 'Updated', status: 'archived' });
    const updated = getProject(project.id);
    expect(updated!.name).toBe('Updated');
    expect(updated!.status).toBe('archived');
  });

  it('throws on updating non-existent project', () => {
    expect(() => updateProject('bad', { name: 'x' })).toThrow();
  });

  it('deletes a project', () => {
    const project = makeProject();
    createProject(project);
    deleteProject(project.id);
    expect(getProject(project.id)).toBeNull();
  });

  it('deletes cascades to entries and tasks', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id));
    createTask(makeTask(project.id));
    deleteProject(project.id);
    const { data: entries, total: eTotal } = getProjectEntries(project.id);
    expect(entries).toHaveLength(0);
    expect(eTotal).toBe(0);
    const { data: tasks, total: tTotal } = getProjectTasks(project.id);
    expect(tasks).toHaveLength(0);
    expect(tTotal).toBe(0);
  });
});

// ---- ENTRIES ----

describe('Entries', () => {
  it('creates and retrieves an entry', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id, { title: 'Plan Entry', section: 'plan' });
    createEntry(entry);
    const retrieved = getEntry(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Plan Entry');
    expect(retrieved!.section).toBe('plan');
  });

  it('gets entries by project and section', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id, { section: 'plan', title: 'A' }));
    createEntry(makeEntry(project.id, { section: 'design', title: 'B' }));
    createEntry(makeEntry(project.id, { section: 'design', title: 'C' }));
    const { data: all, total } = getProjectEntries(project.id);
    expect(all).toHaveLength(3);
    expect(total).toBe(3);
    const { data: design } = getProjectEntries(project.id, 'design');
    expect(design).toHaveLength(2);
  });

  it('updates an entry', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id);
    createEntry(entry);
    updateEntry(entry.id, { title: 'Updated', status: 'done' });
    expect(getEntry(entry.id)!.title).toBe('Updated');
    expect(getEntry(entry.id)!.status).toBe('done');
  });

  it('deletes an entry', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id);
    createEntry(entry);
    deleteEntry(entry.id);
    expect(getEntry(entry.id)).toBeNull();
  });

  it('searches entries by text', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id, { title: 'Database Design', content: 'SQL schema' }));
    createEntry(makeEntry(project.id, { title: 'API Routes', content: 'Express endpoints' }));
    const { data, total } = searchEntries(project.id, 'database');
    expect(data).toHaveLength(1);
    expect(total).toBe(1);
    expect(data[0].title).toBe('Database Design');
  });

  it('FTS5 search finds by content text', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id, { title: 'Setup', content: 'Express endpoints and middleware configuration' }));
    const { data } = searchEntries(project.id, 'middleware');
    expect(data).toHaveLength(1);
  });

  it('FTS5 search is case-insensitive', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id, { title: 'DATABASE SCHEMA', content: 'SQL tables' }));
    const { data } = searchEntries(project.id, 'database');
    expect(data).toHaveLength(1);
  });

  it('FTS5 search with partial prefix', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id, { title: 'Database Design', content: 'SQL schema design' }));
    createEntry(makeEntry(project.id, { title: 'API Routes', content: 'Express endpoints' }));
    const { data } = searchEntries(project.id, 'datab');
    expect(data).toHaveLength(1);
  });
});

// ---- TASKS ----

describe('Tasks', () => {
  it('creates and retrieves a task', () => {
    const project = makeProject();
    createProject(project);
    const task = makeTask(project.id, { title: 'Fix bug', priority: 'high' });
    createTask(task);
    const retrieved = getTask(task.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Fix bug');
    expect(retrieved!.priority).toBe('high');
  });

  it('lists tasks by project', () => {
    const project = makeProject();
    createProject(project);
    createTask(makeTask(project.id));
    createTask(makeTask(project.id));
    const { data, total } = getProjectTasks(project.id);
    expect(data).toHaveLength(2);
    expect(total).toBe(2);
  });

  it('filters tasks by entry', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id);
    createEntry(entry);
    createTask(makeTask(project.id, { sdd_entry_id: entry.id }));
    createTask(makeTask(project.id));
    const { data } = getProjectTasks(project.id, entry.id);
    expect(data).toHaveLength(1);
  });

  it('updates task status', () => {
    const project = makeProject();
    createProject(project);
    const task = makeTask(project.id);
    createTask(task);
    updateTask(task.id, { status: 'completed' });
    expect(getTask(task.id)!.status).toBe('completed');
  });

  it('deletes a task', () => {
    const project = makeProject();
    createProject(project);
    const task = makeTask(project.id);
    createTask(task);
    deleteTask(task.id);
    expect(getTask(task.id)).toBeNull();
  });
});

// ---- CLASSIFICATIONS ----

describe('Classifications', () => {
  it('adds and retrieves classifications', () => {
    const project = makeProject();
    createProject(project);
    const c: Classification = {
      id: 'c1', classifiable_type: 'project', classifiable_id: project.id,
      tag: 'important', confidence: 0.95, created_at: new Date().toISOString(),
    };
    addClassification(c);
    const list = getClassifications('project', project.id);
    expect(list).toHaveLength(1);
    expect(list[0].tag).toBe('important');
  });

  it('removes a classification', () => {
    const project = makeProject();
    createProject(project);
    const c: Classification = {
      id: 'c1', classifiable_type: 'project', classifiable_id: project.id,
      tag: 'important', confidence: 0.95, created_at: new Date().toISOString(),
    };
    addClassification(c);
    removeClassification('c1');
    expect(getClassifications('project', project.id)).toHaveLength(0);
  });
});
