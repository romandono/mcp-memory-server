import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getDatabase } from '../../src/db/init.js';
import { runMigrations } from '../../src/db/migrations/runner.js';

beforeEach(() => {
  initializeDatabase(':memory:');
});

afterEach(() => {
  closeDatabase();
});

describe('Migrations', () => {
  it('creates _migrations table', () => {
    const db = getDatabase();
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'").get();
    expect(result).toBeTruthy();
  });

  it('applies 001_initial_schema migration', () => {
    const db = getDatabase();
    const row = db.prepare("SELECT name FROM _migrations WHERE name='001_initial_schema'").get() as any;
    expect(row).toBeTruthy();
    expect(row.name).toBe('001_initial_schema');
  });

  it('creates all project tables', () => {
    const db = getDatabase();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map(t => t.name).sort();
    expect(names).toContain('projects');
    expect(names).toContain('sdd_entries');
    expect(names).toContain('tasks');
    expect(names).toContain('classifications');
    expect(names).toContain('_migrations');
  });

  it('creates expected indexes', () => {
    const db = getDatabase();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all() as { name: string }[];
    const names = indexes.map(i => i.name).sort();
    expect(names).toContain('idx_entries_project');
    expect(names).toContain('idx_entries_section');
    expect(names).toContain('idx_tasks_project');
    expect(names).toContain('idx_tasks_entry');
    expect(names).toContain('idx_classifications_target');
    expect(names).toContain('idx_classifications_tag');
  });

  it('does not re-apply already-run migrations', () => {
    const db = getDatabase();
    const countBefore = (db.prepare('SELECT COUNT(*) as c FROM _migrations').get() as any).c;

    runMigrations(db);

    const countAfter = (db.prepare('SELECT COUNT(*) as c FROM _migrations').get() as any).c;
    expect(countAfter).toBe(countBefore);
  });

  it('is idempotent when called multiple times', () => {
    const db = getDatabase();

    const countBefore = (db.prepare('SELECT COUNT(*) as c FROM _migrations').get() as any).c;

    runMigrations(db);
    runMigrations(db);

    const countAfter = (db.prepare('SELECT COUNT(*) as c FROM _migrations').get() as any).c;
    expect(countAfter).toBe(countBefore);
  });
});
