import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { initializeDatabase, closeDatabase } from '../../src/db/init.js';
import { createApp } from '../../src/http/server.js';

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  initializeDatabase(':memory:');
  app = createApp();
});

afterEach(() => {
  closeDatabase();
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Projects API', () => {
  it('POST /api/projects creates a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'My Project', description: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/projects rejects missing name', async () => {
    const res = await request(app).post('/api/projects').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/projects lists projects', async () => {
    await request(app).post('/api/projects').send({ name: 'P1' });
    await request(app).post('/api/projects').send({ name: 'P2' });
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(2);
  });

  it('GET /api/projects/:id returns project with entries and tasks', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({ name: 'Full Project' });
    const pid = created.body.id;

    await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Plan' });

    await request(app)
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'Task 1' });

    const res = await request(app).get(`/api/projects/${pid}`);
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Full Project');
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.tasks).toHaveLength(1);
  });

  it('PUT /api/projects/:id updates a project', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({ name: 'Original' });
    const pid = created.body.id;

    await request(app)
      .put(`/api/projects/${pid}`)
      .send({ name: 'Updated', status: 'archived' });

    const res = await request(app).get(`/api/projects/${pid}`);
    expect(res.body.project.name).toBe('Updated');
    expect(res.body.project.status).toBe('archived');
  });

  it('DELETE /api/projects/:id deletes a project', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({ name: 'To Delete' });
    const pid = created.body.id;

    await request(app).delete(`/api/projects/${pid}`);
    const res = await request(app).get(`/api/projects/${pid}`);
    expect(res.status).toBe(404);
  });
});

describe('Entries API', () => {
  let pid: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Project with entries' });
    pid = res.body.id;
  });

  it('POST /api/projects/:pid/entries creates an entry', async () => {
    const res = await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'design', title: 'DB Design', content: 'schema' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/projects/:pid/entries lists entries', async () => {
    await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Plan' });
    await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'design', title: 'Design' });

    const res = await request(app)
      .get(`/api/projects/${pid}/entries`);
    expect(res.body.entries).toHaveLength(2);
  });

  it('GET /api/projects/:pid/entries?section= filters', async () => {
    await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Plan' });
    await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'design', title: 'Design' });

    const res = await request(app)
      .get(`/api/projects/${pid}/entries?section=design`);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].section).toBe('design');
  });

  it('GET /api/projects/:pid/entries/search finds by text', async () => {
    await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Database Design' });

    const res = await request(app)
      .get(`/api/projects/${pid}/entries/search?q=database`);
    expect(res.body.results).toHaveLength(1);
  });

  it('GET /api/projects/:pid/entries/:eid returns single entry', async () => {
    const created = await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Single' });
    const eid = created.body.id;

    const res = await request(app)
      .get(`/api/projects/${pid}/entries/${eid}`);
    expect(res.body.entry.title).toBe('Single');
  });

  it('PUT /api/projects/:pid/entries/:eid updates', async () => {
    const created = await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Old' });
    const eid = created.body.id;

    await request(app)
      .put(`/api/projects/${pid}/entries/${eid}`)
      .send({ title: 'New Title', status: 'done' });

    const res = await request(app)
      .get(`/api/projects/${pid}/entries/${eid}`);
    expect(res.body.entry.title).toBe('New Title');
    expect(res.body.entry.status).toBe('done');
  });

  it('DELETE /api/projects/:pid/entries/:eid deletes', async () => {
    const created = await request(app)
      .post(`/api/projects/${pid}/entries`)
      .send({ section: 'plan', title: 'Delete me' });
    const eid = created.body.id;

    await request(app)
      .delete(`/api/projects/${pid}/entries/${eid}`);

    const res = await request(app)
      .get(`/api/projects/${pid}/entries/${eid}`);
    expect(res.status).toBe(404);
  });
});

describe('Tasks API', () => {
  let pid: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Project with tasks' });
    pid = res.body.id;
  });

  it('POST /api/projects/:pid/tasks creates a task', async () => {
    const res = await request(app)
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'New Task', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/projects/:pid/tasks lists tasks', async () => {
    await request(app)
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'T1' });
    await request(app)
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'T2' });

    const res = await request(app)
      .get(`/api/projects/${pid}/tasks`);
    expect(res.body.tasks).toHaveLength(2);
  });

  it('PUT /api/projects/:pid/tasks/:tid updates status', async () => {
    const created = await request(app)
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'Do something' });
    const tid = created.body.id;

    await request(app)
      .put(`/api/projects/${pid}/tasks/${tid}`)
      .send({ status: 'completed' });

    const res = await request(app)
      .get(`/api/projects/${pid}/tasks`);
    expect(res.body.tasks[0].status).toBe('completed');
  });

  it('DELETE /api/projects/:pid/tasks/:tid deletes', async () => {
    const created = await request(app)
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'Delete me' });
    const tid = created.body.id;

    await request(app)
      .delete(`/api/projects/${pid}/tasks/${tid}`);

    const res = await request(app)
      .get(`/api/projects/${pid}/tasks`);
    expect(res.body.tasks).toHaveLength(0);
  });
});

describe('Classifications API', () => {
  let pid: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Classifiable project' });
    pid = res.body.id;
  });

  it('POST /api/classify adds a classification', async () => {
    const res = await request(app)
      .post('/api/classify')
      .send({ classifiable_type: 'project', classifiable_id: pid, tag: 'urgent', confidence: 1 });
    expect(res.status).toBe(201);
    expect(res.body.classification.tag).toBe('urgent');
  });

  it('POST /api/classify rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/classify')
      .send({});
    expect(res.status).toBe(400);
  });
});
