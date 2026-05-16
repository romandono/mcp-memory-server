import Database from 'better-sqlite3';

export interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

function toFtsQuery(input: string): string {
  return input
    .replace(/['"()|]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => `"${w}"*`)
    .join(' ');
}

export { toFtsQuery };

const migrations: Migration[] = [
  {
    name: '001_initial_schema',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','completed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sdd_entries (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          section TEXT NOT NULL CHECK(section IN ('plan','design','tasks','general')),
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','done')),
          parent_id TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY(parent_id) REFERENCES sdd_entries(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          sdd_entry_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','cancelled')),
          priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY(sdd_entry_id) REFERENCES sdd_entries(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS classifications (
          id TEXT PRIMARY KEY,
          classifiable_type TEXT NOT NULL CHECK(classifiable_type IN ('project','entry','task')),
          classifiable_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entries_project ON sdd_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_entries_section ON sdd_entries(project_id, section);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_entry ON tasks(sdd_entry_id);
        CREATE INDEX IF NOT EXISTS idx_classifications_target ON classifications(classifiable_type, classifiable_id);
        CREATE INDEX IF NOT EXISTS idx_classifications_tag ON classifications(tag);
      `);
    },
  },
  {
    name: '002_add_fts5',
    up(db) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_entries USING fts5(
          entry_id UNINDEXED,
          section,
          title,
          content
        );

        CREATE TRIGGER IF NOT EXISTS fts_entries_ai AFTER INSERT ON sdd_entries BEGIN
          INSERT INTO fts_entries(entry_id, section, title, content) VALUES (new.id, new.section, new.title, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS fts_entries_ad AFTER DELETE ON sdd_entries BEGIN
          DELETE FROM fts_entries WHERE entry_id = old.id;
        END;

        CREATE TRIGGER IF NOT EXISTS fts_entries_au AFTER UPDATE ON sdd_entries BEGIN
          DELETE FROM fts_entries WHERE entry_id = old.id;
          INSERT INTO fts_entries(entry_id, section, title, content) VALUES (new.id, new.section, new.title, new.content);
        END;
      `);

      const count = (db.prepare('SELECT COUNT(*) as c FROM sdd_entries').get() as any).c;
      if (count > 0) {
        db.prepare(`
          INSERT INTO fts_entries(entry_id, section, title, content)
          SELECT id, section, title, content FROM sdd_entries
        `).run();
        console.log(`[MIGRATION] Indexed ${count} existing entries in FTS5`);
      }
    },
  },
  {
    name: '003_add_audit_log',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('entry','task')),
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('created','updated','deleted')),
          changes TEXT,
          project_id TEXT,
          timestamp TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(project_id);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

        CREATE TRIGGER IF NOT EXISTS audit_entries_ai AFTER INSERT ON sdd_entries BEGIN
          INSERT INTO audit_log (id, entity_type, entity_id, action, changes, project_id, timestamp)
          VALUES (lower(hex(randomblob(16))), 'entry', new.id, 'created',
            json_object('title', new.title, 'content', new.content, 'section', new.section, 'status', new.status),
            new.project_id, new.created_at);
        END;

        CREATE TRIGGER IF NOT EXISTS audit_entries_au AFTER UPDATE ON sdd_entries BEGIN
          INSERT INTO audit_log (id, entity_type, entity_id, action, changes, project_id, timestamp)
          VALUES (lower(hex(randomblob(16))), 'entry', old.id, 'updated',
            json_object('old', json_object('title', old.title, 'content', old.content, 'section', old.section, 'status', old.status),
                        'new', json_object('title', new.title, 'content', new.content, 'section', new.section, 'status', new.status)),
            new.project_id, new.updated_at);
        END;

        CREATE TRIGGER IF NOT EXISTS audit_entries_ad AFTER DELETE ON sdd_entries BEGIN
          INSERT INTO audit_log (id, entity_type, entity_id, action, changes, project_id, timestamp)
          VALUES (lower(hex(randomblob(16))), 'entry', old.id, 'deleted',
            json_object('title', old.title),
            old.project_id, datetime('now'));
        END;

        CREATE TRIGGER IF NOT EXISTS audit_tasks_ai AFTER INSERT ON tasks BEGIN
          INSERT INTO audit_log (id, entity_type, entity_id, action, changes, project_id, timestamp)
          VALUES (lower(hex(randomblob(16))), 'task', new.id, 'created',
            json_object('title', new.title, 'status', new.status, 'priority', new.priority),
            new.project_id, new.created_at);
        END;

        CREATE TRIGGER IF NOT EXISTS audit_tasks_au AFTER UPDATE ON tasks BEGIN
          INSERT INTO audit_log (id, entity_type, entity_id, action, changes, project_id, timestamp)
          VALUES (lower(hex(randomblob(16))), 'task', old.id, 'updated',
            json_object('old', json_object('title', old.title, 'status', old.status, 'priority', old.priority),
                        'new', json_object('title', new.title, 'status', new.status, 'priority', new.priority)),
            new.project_id, new.updated_at);
        END;

        CREATE TRIGGER IF NOT EXISTS audit_tasks_ad AFTER DELETE ON tasks BEGIN
          INSERT INTO audit_log (id, entity_type, entity_id, action, changes, project_id, timestamp)
          VALUES (lower(hex(randomblob(16))), 'task', old.id, 'deleted',
            json_object('title', old.title),
            old.project_id, datetime('now'));
        END;
      `);
    },
  },
];

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedNames(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations ORDER BY id').all() as { name: string }[];
  return new Set(rows.map(r => r.name));
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);
  const applied = getAppliedNames(db);

  for (const m of migrations) {
    if (applied.has(m.name)) {
      console.log(`[MIGRATION] ${m.name} already applied, skipping`);
      continue;
    }

    console.log(`[MIGRATION] Applying ${m.name}...`);
    m.up(db);
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(m.name, new Date().toISOString());
    console.log(`[MIGRATION] ${m.name} applied`);
  }

  console.log(`[MIGRATION] All migrations up to date (${migrations.length} total)`);
}
