import { DatabaseSync } from 'node:sqlite'
import { ensureRuntimePaths, resolveRuntimePaths } from '../core/paths'

export function openRuntimeDb(root?: string): DatabaseSync {
  const paths = resolveRuntimePaths(root)
  ensureRuntimePaths(paths)
  const db = new DatabaseSync(paths.dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow TEXT NOT NULL,
      brand TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      current_step TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      parent_run_id TEXT
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      step TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );
  `)

  return db
}

