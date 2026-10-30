import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const g = globalThis as unknown as { __ttdb?: Database.Database };

export function db(): Database.Database {
  if (g.__ttdb) return g.__ttdb;
  const file = process.env.DB_PATH || path.join(process.cwd(), "data", "thinktime.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const d = new Database(file);
  d.pragma("journal_mode = WAL");
  d.pragma("busy_timeout = 5000");
  d.exec(`
    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      address TEXT,
      install_id TEXT,
      campaign_id INTEGER,
      category TEXT,
      site TEXT,
      generation_ms INTEGER,
      visible_ms INTEGER,
      status TEXT NOT NULL CHECK (status IN ('pending','paid','rejected')),
      reject_reason TEXT,
      batch_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_views_status ON views(status, campaign_id);
    CREATE INDEX IF NOT EXISTS idx_views_addr ON views(address, created_at);
    CREATE TABLE IF NOT EXISTS batches (
      batch_id TEXT PRIMARY KEY,
      campaign_id INTEGER,
      tx_hash TEXT,
      total_views INTEGER,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS installs (
      install_id TEXT,
      address TEXT,
      first_seen INTEGER,
      PRIMARY KEY (install_id, address)
    );
  `);
  g.__ttdb = d;
  return d;
}
