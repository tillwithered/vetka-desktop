import type { DatabaseSync } from 'node:sqlite';

import migrationV0 from './migrations/0001_v0.sql?raw';

export function runMigrations(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN IMMEDIATE');

  try {
    db.exec(migrationV0);
    db.prepare(
      'insert or ignore into schema_migrations (version, applied_at) values (?, ?)',
    ).run(1, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
