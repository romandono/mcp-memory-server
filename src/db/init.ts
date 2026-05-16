import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations/runner.js';

let db: Database.Database;
let currentDbPath: string;

export function getDbPath(): string {
  if (!currentDbPath) throw new Error('Database not initialized');
  return currentDbPath;
}

export function initializeDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  currentDbPath = dbPath;
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  console.log('[DB] Database initialized successfully at:', dbPath);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    console.log('[DB] Database connection closed.');
  }
}
