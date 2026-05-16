import Database from 'better-sqlite3';

export interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

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
