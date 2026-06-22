import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase } from '../../src/db/init.js';
import { handleProjectCreate, handleProjectList, handleProjectGet } from '../../src/tools/project.js';
import { handleEntryCreate, handleEntryGet, handleEntrySearch, handleGlobalEntrySearch, handleEntryUpdate, handleEntryDelete } from '../../src/tools/entry.js';
import { handleTaskCreate, handleTaskList, handleTaskUpdate } from '../../src/tools/task.js';
import { handleAddDecision, handleAddRelationship, handleGetEntryContext } from '../../src/tools/context.js';

beforeEach(() => {
  initializeDatabase(':memory:');
});

afterEach(() => {
  closeDatabase();
});

describe('project tools', () => {
  it('handleProjectCreate creates a project', async () => {
    const result = await handleProjectCreate({ name: 'Test Project', description: 'desc' });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.message).toContain('Test Project');
  });

  it('handleProjectCreate rejects empty name', async () => {
    await expect(handleProjectCreate({ name: '' })).rejects.toThrow();
  });

  it('handleProjectCreate rejects missing name', async () => {
    await expect(handleProjectCreate({})).rejects.toThrow();
  });

  it('handleProjectList returns empty list', async () => {
    const result = await handleProjectList();
    expect(result.success).toBe(true);
    expect(result.projects).toEqual([]);
  });

  it('handleProjectList returns all projects', async () => {
    await handleProjectCreate({ name: 'A' });
    await handleProjectCreate({ name: 'B' });
    const result = await handleProjectList();
    expect(result.projects).toHaveLength(2);
  });

  it('handleProjectList with pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await handleProjectCreate({ name: `Project ${i}` });
    }
    const result = await handleProjectList({ page: 1, limit: 2 });
    expect(result.projects).toHaveLength(2);
    expect(result.pagination).toBeDefined();
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('handleProjectGet returns project with entries and tasks', async () => {
    const created = await handleProjectCreate({ name: 'Full' });
    const pid = created.id;

    await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Entry 1' });
    await handleTaskCreate({ project_id: pid, title: 'Task 1' });

    const result = await handleProjectGet({ id: pid });
    expect(result.success).toBe(true);
    expect(result.project.name).toBe('Full');
    expect(result.entries).toHaveLength(1);
    expect(result.tasks).toHaveLength(1);
  });

  it('handleProjectGet returns not found', async () => {
    const result = await handleProjectGet({ id: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

describe('entry tools', () => {
  let pid: string;

  beforeEach(async () => {
    const result = await handleProjectCreate({ name: 'Test' });
    pid = result.id;
  });

  it('handleEntryCreate creates an entry', async () => {
    const result = await handleEntryCreate({
      project_id: pid,
      section: 'design',
      title: 'DB Schema',
      content: 'tables',
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.message).toContain('DB Schema');
  });

  it('handleEntryCreate with optional parent_id', async () => {
    const parent = await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Parent' });
    const child = await handleEntryCreate({
      project_id: pid,
      section: 'plan',
      title: 'Child',
      parent_id: parent.id,
    });
    expect(child.success).toBe(true);
  });

  it('handleEntryCreate rejects missing title', async () => {
    await expect(handleEntryCreate({ project_id: pid, section: 'plan' })).rejects.toThrow();
  });

  it('handleEntryGet returns all entries', async () => {
    await handleEntryCreate({ project_id: pid, section: 'plan', title: 'A' });
    await handleEntryCreate({ project_id: pid, section: 'design', title: 'B' });
    const result = await handleEntryGet({ project_id: pid });
    expect(result.count).toBe(2);
  });

  it('handleEntryGet filters by section', async () => {
    await handleEntryCreate({ project_id: pid, section: 'plan', title: 'A' });
    await handleEntryCreate({ project_id: pid, section: 'design', title: 'B' });
    const result = await handleEntryGet({ project_id: pid, section: 'design' });
    expect(result.count).toBe(1);
    expect(result.entries[0].section).toBe('design');
  });

  it('handleEntryGet with pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await handleEntryCreate({ project_id: pid, section: 'plan', title: `Entry ${i}` });
    }
    const result = await handleEntryGet({ project_id: pid, page: 1, limit: 2 });
    expect(result.entries).toHaveLength(2);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(5);
  });

  it('handleEntrySearch with pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await handleEntryCreate({ project_id: pid, section: 'plan', title: `Target ${i}` });
    }
    const result = await handleEntrySearch({ project_id: pid, query: 'Target', page: 2, limit: 2 });
    expect(result.results).toHaveLength(2);
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.total).toBe(5);
  });

  it('handleEntrySearch finds by text', async () => {
    await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Database Design', content: 'SQL' });
    await handleEntryCreate({ project_id: pid, section: 'plan', title: 'API Routes', content: 'Express' });
    const result = await handleEntrySearch({ project_id: pid, query: 'database' });
    expect(result.count).toBe(1);
    expect(result.results[0].title).toBe('Database Design');
  });

  it('handleGlobalEntrySearch searches across all projects', async () => {
    const pid2 = (await handleProjectCreate({ name: 'Project 2' })).id;
    await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Database Design', content: 'SQL' });
    await handleEntryCreate({ project_id: pid2, section: 'plan', title: 'API Design', content: 'Express' });
    const result = await handleGlobalEntrySearch({ query: 'design' });
    expect(result.count).toBe(2);
  });

  it('handleGlobalEntrySearch with pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await handleEntryCreate({ project_id: pid, section: 'plan', title: `Target ${i}` });
    }
    const result = await handleGlobalEntrySearch({ query: 'Target', page: 1, limit: 2 });
    expect(result.results).toHaveLength(2);
    expect(result.pagination).toBeDefined();
    expect(result.pagination.total).toBe(5);
  });

  it('handleGlobalEntrySearch returns empty for no match', async () => {
    const result = await handleGlobalEntrySearch({ query: 'zzzz' });
    expect(result.count).toBe(0);
  });

  it('handleEntrySearch returns empty for no match', async () => {
    const result = await handleEntrySearch({ project_id: pid, query: 'zzzz' });
    expect(result.count).toBe(0);
  });

  it('handleEntryUpdate updates an entry', async () => {
    const created = await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Old Title', content: 'old' });
    const result = await handleEntryUpdate({ id: created.id, title: 'New Title', status: 'done' });
    expect(result.success).toBe(true);
    expect(result.entry.title).toBe('New Title');
    expect(result.entry.status).toBe('done');
  });

  it('handleEntryUpdate returns not found', async () => {
    const result = await handleEntryUpdate({ id: 'bad' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('handleEntryDelete deletes an entry', async () => {
    const created = await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Delete me' });
    const result = await handleEntryDelete({ id: created.id });
    expect(result.success).toBe(true);
    expect(result.message).toContain('deleted');
    const getResult = await handleEntryGet({ project_id: pid });
    expect(getResult.count).toBe(0);
  });

  it('handleEntryDelete returns not found', async () => {
    const result = await handleEntryDelete({ id: 'bad' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

describe('context tools', () => {
  let pid: string;
  let eid: string;

  beforeEach(async () => {
    const p = await handleProjectCreate({ name: 'Ctx Project' });
    pid = p.id;
    eid = (await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Test Entry' })).id;
  });

  it('handleAddDecision records a decision', async () => {
    const result = await handleAddDecision({
      entry_id: eid, decision: 'Use FTS5', rationale: 'Fast search',
      alternatives_considered: 'LIKE',
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('Use FTS5');
  });

  it('handleAddDecision rejects non-existent entry', async () => {
    const result = await handleAddDecision({
      entry_id: 'bad', decision: 'x', rationale: 'y',
    });
    expect(result.success).toBe(false);
  });

  it('handleAddRelationship links two entries', async () => {
    const eid2 = (await handleEntryCreate({ project_id: pid, section: 'plan', title: 'Other' })).id;
    const result = await handleAddRelationship({
      source_entry_id: eid, target_entry_id: eid2, relationship_type: 'depends_on',
    });
    expect(result.success).toBe(true);
  });

  it('handleAddRelationship rejects non-existent source', async () => {
    const result = await handleAddRelationship({
      source_entry_id: 'bad', target_entry_id: eid, relationship_type: 'related_to',
    });
    expect(result.success).toBe(false);
  });

  it('handleGetEntryContext returns full context', async () => {
    await handleAddDecision({ entry_id: eid, decision: 'Use SQLite', rationale: 'Embedded' });
    const result = await handleGetEntryContext({ entry_id: eid });
    expect(result.success).toBe(true);
    expect(result.context.entry.title).toBe('Test Entry');
    expect(result.context.decisions).toHaveLength(1);
    expect(result.context.relationships).toHaveLength(0);
  });

  it('handleGetEntryContext returns not found', async () => {
    const result = await handleGetEntryContext({ entry_id: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

describe('task tools', () => {
  let pid: string;

  beforeEach(async () => {
    const result = await handleProjectCreate({ name: 'Test' });
    pid = result.id;
  });

  it('handleTaskCreate creates a task', async () => {
    const result = await handleTaskCreate({ project_id: pid, title: 'Fix bug', priority: 'high' });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.message).toContain('Fix bug');
  });

  it('handleTaskCreate with sdd_entry_id', async () => {
    const entry = await handleEntryCreate({ project_id: pid, section: 'tasks', title: 'Entry' });
    const result = await handleTaskCreate({ project_id: pid, title: 'Subtask', sdd_entry_id: entry.id });
    expect(result.success).toBe(true);
  });

  it('handleTaskCreate rejects missing title', async () => {
    await expect(handleTaskCreate({ project_id: pid })).rejects.toThrow();
  });

  it('handleTaskList returns tasks', async () => {
    await handleTaskCreate({ project_id: pid, title: 'T1' });
    await handleTaskCreate({ project_id: pid, title: 'T2' });
    const result = await handleTaskList({ project_id: pid });
    expect(result.count).toBe(2);
  });

  it('handleTaskList with pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await handleTaskCreate({ project_id: pid, title: `Task ${i}` });
    }
    const result = await handleTaskList({ project_id: pid, page: 1, limit: 3 });
    expect(result.tasks).toHaveLength(3);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('handleTaskList filters by sdd_entry_id', async () => {
    const entry = await handleEntryCreate({ project_id: pid, section: 'tasks', title: 'Entry' });
    await handleTaskCreate({ project_id: pid, title: 'Linked', sdd_entry_id: entry.id });
    await handleTaskCreate({ project_id: pid, title: 'Unlinked' });
    const result = await handleTaskList({ project_id: pid, sdd_entry_id: entry.id });
    expect(result.count).toBe(1);
    expect(result.tasks[0].title).toBe('Linked');
  });

  it('handleTaskUpdate changes status', async () => {
    const created = await handleTaskCreate({ project_id: pid, title: 'Do it' });
    const result = await handleTaskUpdate({ id: created.id, status: 'completed' });
    expect(result.success).toBe(true);
    expect(result.message).toContain('completed');
  });

  it('handleTaskUpdate returns not found', async () => {
    const result = await handleTaskUpdate({ id: 'bad', status: 'completed' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
