import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getDatabase } from '../../src/db/init.js';
import { createProject, createEntry, updateEntry, deleteEntry, createTask, updateTask, deleteTask, getAuditLog } from '../../src/db/schema.js';
import { Project, SddEntry, Task } from '../../src/types/context.js';

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

describe('Audit Log', () => {
  it('records entry creation', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id);
    createEntry(entry);

    const { data, total } = getAuditLog();
    expect(total).toBeGreaterThanOrEqual(1);
    const audit = data.find(a => a.entity_id === entry.id);
    expect(audit).toBeDefined();
    expect(audit!.action).toBe('created');
    expect(audit!.entity_type).toBe('entry');
  });

  it('records entry update', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id);
    createEntry(entry);

    updateEntry(entry.id, { title: 'Updated Title' });

    const { data } = getAuditLog({ entity_id: entry.id });
    const updates = data.filter(a => a.action === 'updated');
    expect(updates.length).toBeGreaterThanOrEqual(1);
  });

  it('records entry deletion', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id);
    createEntry(entry);

    deleteEntry(entry.id);

    const { data } = getAuditLog({ entity_id: entry.id });
    const deletes = data.filter(a => a.action === 'deleted');
    expect(deletes).toHaveLength(1);
  });

  it('records task creation', () => {
    const project = makeProject();
    createProject(project);
    const task = makeTask(project.id);
    createTask(task);

    const { data } = getAuditLog({ entity_id: task.id });
    expect(data).toHaveLength(1);
    expect(data[0].action).toBe('created');
    expect(data[0].entity_type).toBe('task');
  });

  it('records task update', () => {
    const project = makeProject();
    createProject(project);
    const task = makeTask(project.id);
    createTask(task);

    updateTask(task.id, { status: 'completed' });

    const { data } = getAuditLog({ entity_id: task.id });
    expect(data.filter(a => a.action === 'updated').length).toBeGreaterThanOrEqual(1);
  });

  it('records task deletion', () => {
    const project = makeProject();
    createProject(project);
    const task = makeTask(project.id);
    createTask(task);

    deleteTask(task.id);

    const { data } = getAuditLog({ entity_id: task.id });
    expect(data.filter(a => a.action === 'deleted')).toHaveLength(1);
  });

  it('filters audit log by entity_type', () => {
    const project = makeProject();
    createProject(project);
    createEntry(makeEntry(project.id));
    createTask(makeTask(project.id));

    const { data: entries } = getAuditLog({ entity_type: 'entry' });
    expect(entries.every(e => e.entity_type === 'entry')).toBe(true);

    const { data: tasks } = getAuditLog({ entity_type: 'task' });
    expect(tasks.every(t => t.entity_type === 'task')).toBe(true);
  });

  it('filters audit log by project_id', () => {
    const p1 = makeProject({ id: 'proj-a' });
    const p2 = makeProject({ id: 'proj-b' });
    createProject(p1);
    createProject(p2);
    createEntry(makeEntry('proj-a'));
    createEntry(makeEntry('proj-b'));

    const { data } = getAuditLog({ project_id: 'proj-a' });
    expect(data.every(e => e.project_id === 'proj-a')).toBe(true);
  });

  it('paginates audit log results', () => {
    const project = makeProject();
    createProject(project);
    for (let i = 0; i < 5; i++) {
      createEntry(makeEntry(project.id, { id: `entry-${i}` }));
    }

    const { data, total } = getAuditLog({ project_id: project.id }, { page: 1, limit: 2 });
    expect(data).toHaveLength(2);
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('stores changes as JSON with old/new snapshots on update', () => {
    const project = makeProject();
    createProject(project);
    const entry = makeEntry(project.id, { title: 'Original', content: 'original content' });
    createEntry(entry);

    updateEntry(entry.id, { title: 'Updated', content: 'new content' });

    const { data } = getAuditLog({ entity_id: entry.id, entity_type: 'entry' });
    const updateAudit = data.find(a => a.action === 'updated');
    expect(updateAudit).toBeDefined();
    const changes = JSON.parse(updateAudit!.changes);
    expect(changes.old.title).toBe('Original');
    expect(changes.new.title).toBe('Updated');
  });
});
