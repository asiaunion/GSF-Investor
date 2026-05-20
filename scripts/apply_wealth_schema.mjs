#!/usr/bin/env node
/**
 * Apply wealth_positions + net_worth_snapshots (when drizzle-kit push fails on views).
 * Usage: node scripts/apply_wealth_schema.mjs [database_url]
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] || process.env.TURSO_DATABASE_URL || `file:${path.join(ROOT, "local.db")}`;

function isRemote(url) {
  const u = (url || "").toLowerCase();
  return u.includes("libsql://") || u.includes("turso.io");
}

if (isRemote(url) && process.env.REAL_DATA_RUN_ACK !== "I_ACK_PROD_WRITE") {
  console.error(
    "[ERROR] Remote DB: set REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE or use file:./local.db"
  );
  process.exit(2);
}

const SQL = [
  `CREATE TABLE IF NOT EXISTS wealth_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    big_category TEXT NOT NULL,
    broker TEXT,
    name TEXT NOT NULL,
    ticker TEXT,
    quantity REAL DEFAULT 1,
    book_value REAL,
    value_krw REAL NOT NULL,
    currency TEXT DEFAULT 'KRW',
    is_liability INTEGER DEFAULT 0,
    note TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_wealth_positions ON wealth_positions(broker, category, name)`,
  `CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    total_assets REAL NOT NULL,
    total_debt REAL NOT NULL,
    net_worth REAL NOT NULL,
    securities_krw REAL,
    wealth_assets_krw REAL,
    liabilities_krw REAL,
    breakdown_json TEXT
  )`,
];

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

for (const q of SQL) {
  await client.execute(q);
}
console.log(`✅ wealth schema applied on ${url}`);
