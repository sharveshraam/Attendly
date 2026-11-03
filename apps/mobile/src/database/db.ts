import * as SQLite from 'expo-sqlite';

/**
 * Local SQLite store for offline support. Holds:
 *  - cache:    last-synced query snapshots (read offline)
 *  - outbox:   durable pending mutations (replayed on reconnect)
 *  - notes:    local-first notes (cloud sync pending an additive backend table)
 *  - assignment_meta: local-only priority overlay (no priority column in schema)
 *
 * Sensitive auth sessions are NOT stored here — they live in SecureStore.
 */
let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('attendly-mobile.db');
    db.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        base_version TEXT
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        course_id TEXT,
        semester_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assignment_meta (
        assignment_id TEXT PRIMARY KEY NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium'
      );
    `);
  }
  return db;
}

export function resetDbForTests(): void {
  db = null;
}
