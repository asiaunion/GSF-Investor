#!/usr/bin/env node
/**
 * Single source for SQL views (v_portfolio).
 * Used by: npm run db:dev:setup, scripts/create_views.py (via export string).
 *
 * Usage:
 *   node scripts/db-views.mjs [database_url]
 * Default: file:./local.db
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export const V_PORTFOLIO_SQL = `
CREATE VIEW IF NOT EXISTS v_portfolio AS
WITH positions AS (
  SELECT
    stock_id,
    SUM(CASE WHEN action IN ('BUY', 'INIT') THEN quantity ELSE -quantity END) AS quantity,
    SUM(CASE WHEN action IN ('BUY', 'INIT') THEN quantity * price ELSE 0 END) AS total_cost,
    SUM(CASE WHEN action IN ('BUY', 'INIT') THEN quantity ELSE 0 END) AS total_bought,
    MAX(currency) AS currency
  FROM trade_journal
  GROUP BY stock_id
  HAVING quantity > 0
)
SELECT
  s.id AS stock_id,
  s.ticker,
  s.name,
  s.market,
  s.category,
  s.broker,
  p.quantity,
  ROUND(p.total_cost / p.total_bought, 0) AS avg_price,
  p.currency
FROM positions p
JOIN stocks s ON s.id = p.stock_id
WHERE s.is_active = 1
`;

async function main() {
  const url = process.argv[2] || process.env.TURSO_DATABASE_URL || `file:${path.join(ROOT, "local.db")}`;
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  await client.execute(V_PORTFOLIO_SQL);
  console.log(`✅ v_portfolio view applied on ${url}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
