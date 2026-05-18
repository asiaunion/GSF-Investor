#!/usr/bin/env node
/**
 * Local design-preview database: schema push + demo seed + views.
 * Usage: npm run db:dev:setup
 */
import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = path.join(ROOT, "local.db");
const DB_URL = `file:${DB_PATH}`;

const V_PORTFOLIO = `
CREATE VIEW v_portfolio AS
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

function run(cmd, env = {}) {
  execSync(cmd, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, TURSO_DATABASE_URL: DB_URL, TURSO_AUTH_TOKEN: "", ...env },
  });
}

async function seed() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

  run("npx drizzle-kit push --force");

  const client = createClient({ url: DB_URL });
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const statements = [
    `INSERT INTO stocks (ticker, name, market, category, sector, broker, thesis, is_active) VALUES
      ('005380', '현대차', 'KR', 'Core', 'Automotive', '키움', '전동화·ROE 개선', 1),
      ('AAPL', 'Apple', 'US', 'Satellite', 'Technology', '키움', '서비스 믹스·FCF', 1),
      ('069500', 'KODEX 200', 'KR', 'Satellite', 'ETF', NULL, '벤치마크', 1),
      ('035420', 'NAVER', 'KR', 'Satellite', 'Technology', '키움', '광고·커머스', 1)`,

    `INSERT INTO exchange_rates (pair, date, rate) VALUES ('USDKRW', '${today}', 1385.5)`,

    `INSERT INTO trade_journal (stock_id, traded_at, action, quantity, price, currency, thesis, category, emotion_tag, confidence_score) VALUES
      (1, '${monthAgo}', 'INIT', 50, 210000, 'KRW', '코어 포지션', 'Core', '확신', 4),
      (2, '${monthAgo}', 'INIT', 30, 178.5, 'USD', '위성 성장주', 'Satellite', '계획적', 3),
      (3, '${monthAgo}', 'INIT', 100, 32000, 'KRW', '벤치마크', 'Satellite', '계획적', 5),
      (4, '${monthAgo}', 'INIT', 20, 195000, 'KRW', '플랫폼', 'Satellite', '확신', 4)`,

    `INSERT INTO prices (stock_id, date, close_price, currency) VALUES
      (1, '${today}', 248000, 'KRW'),
      (2, '${today}', 198.2, 'USD'),
      (3, '${today}', 34500, 'KRW'),
      (4, '${today}', 212000, 'KRW')`,

    `INSERT INTO financials (stock_id, period, revenue, op_income, net_income, debt_ratio, eps, bps, dividend_per_share, source) VALUES
      (1, '2025FY', 1.6e14, 1.2e13, 9e12, 42.5, 18500, 185000, 12000, 'DART'),
      (2, '2025FY', 4e14, 1.2e14, 9.7e13, 28.0, 6.2, 4.5, 0.96, 'SEC'),
      (4, '2025FY', 9e12, 1.5e12, 8e11, 18.2, 5200, 95000, 0, 'DART')`,

    `INSERT INTO signals (stock_id, type, severity, description, is_resolved, detected_at) VALUES
      (1, 'INSIDER_BUY', 'HIGH', '임원 장내 매수 공시', 0, datetime('now', '-2 days')),
      (2, 'STAKE_CHANGE', 'MEDIUM', '기관 지분율 +0.8%p', 0, datetime('now', '-5 days')),
      (4, 'EARNINGS', 'LOW', '분기 실적 컨센서스 상회', 1, datetime('now', '-12 days'))`,

    `INSERT INTO stock_loans (stock_id, label, loan_amount, interest_rate, started_at, is_active, note) VALUES
      (1, '현대차 담보 대출', 25000000, 5.2, '${monthAgo}', 1, '증권사 융자')`,

    `INSERT INTO disclosures (stock_id, source, filed_at, title, summary_ai) VALUES
      (1, 'DART', '${today}', '주요사항보고서(임원변동)', '대표이사 보임'),
      (2, 'SEC', '${today}', 'Form 4', 'Insider purchase')`,

    `INSERT INTO reports (stock_id, trigger, content_md) VALUES
      (1, 'MANUAL', '# 현대차 분석\\n\\n## 요약\\n- 전동화 전환 가속\\n- 밸류에이션 중립\\n\\n## 리스크\\n- 환율·금리')`,
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }

  await client.execute("DROP VIEW IF EXISTS v_portfolio");
  await client.execute(V_PORTFOLIO);

  client.close();
  console.log("\n✅ Local DB ready:", DB_PATH);
  console.log("   Next: cp .env.example .env.local && npm run dev:preview");
}

async function main() {
  console.log("📦 GSF-Investor local dev setup\n");
  await seed();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
