import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Suspense } from "react";
import DashboardClient from "@/app/DashboardClient";
import type { ActivityItem } from "@/components/ActivityTimeline";
import AppPageLayout from "@/components/AppPageLayout";
import { computeNetWorth, formatKrw } from "@/lib/net-worth";
import { fetchDisplayCurrency } from "@/lib/display-currency";

export const dynamic = "force-dynamic";

// ── 데이터 페칭 (Server Side) ─────────────────────────────────────────────────
async function fetchDashboardData() {
  const portfolioRows = await db.run(sql`
    SELECT
      s.id AS stock_id,
      vp.ticker,
      vp.name,
      vp.market,
      vp.category,
      vp.broker,
      vp.quantity,
      vp.avg_price,
      vp.currency,
      s.sector
    FROM v_portfolio vp
    JOIN stocks s ON s.ticker = vp.ticker
  `);

  const latestPricesRows = await db.run(sql`
    SELECT p.stock_id, p.close_price, p.currency, p.date
    FROM prices p
    INNER JOIN (
      SELECT stock_id, MAX(date) AS max_date FROM prices GROUP BY stock_id
    ) latest ON p.stock_id = latest.stock_id AND p.date = latest.max_date
  `);

  const fxRow = await db.run(sql`
    SELECT rate, date FROM exchange_rates WHERE pair = 'USDKRW'
    ORDER BY date DESC LIMIT 1
  `);

  const benchmarkRows = await db.run(sql`
    SELECT
      p1.close_price AS latest_price,
      p2.close_price AS base_price,
      p1.date AS latest_date
    FROM prices p1
    JOIN stocks bm ON bm.ticker = '069500' AND p1.stock_id = bm.id
    JOIN prices p2 ON p2.stock_id = bm.id
      AND p2.date = (
        SELECT date FROM prices
        WHERE stock_id = bm.id
          AND date <= date((SELECT MAX(date) FROM prices WHERE stock_id = bm.id), '-30 days')
        ORDER BY date DESC LIMIT 1
      )
    ORDER BY p1.date DESC
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  const latestPriceMap = new Map<number, { closePrice: number; currency: string; date: string }>();
  for (const row of latestPricesRows.rows) {
    latestPriceMap.set(Number(row[0]), {
      closePrice: Number(row[1]),
      currency: String(row[2]),
      date: String(row[3]),
    });
  }

  const usdKrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;
  const fxDate = fxRow.rows.length > 0 ? String(fxRow.rows[0][1]) : null;

  let benchmarkReturn: number | null = null;
  if (benchmarkRows.rows.length > 0) {
    const latestPrice = Number(benchmarkRows.rows[0][0]);
    const basePrice = Number(benchmarkRows.rows[0][1]);
    if (basePrice > 0 && latestPrice > 0) {
      benchmarkReturn = ((latestPrice - basePrice) / basePrice) * 100;
    }
  }

  const holdings = portfolioRows.rows.map((row) => {
    const stockId = Number(row[0]);
    const ticker = String(row[1]);
    const name = String(row[2]);
    const market = String(row[3]);
    const category = String(row[4]);
    const broker = row[5] ? String(row[5]) : null;
    const quantity = Number(row[6]);
    const avgPrice = Number(row[7]);
    const currency = String(row[8]);
    const sector = row[9] ? String(row[9]) : null;

    const latest = latestPriceMap.get(stockId);
    const currentPrice = latest?.closePrice ?? avgPrice;
    const priceDate = latest?.date ?? null;

    const evalAmountLocal = currentPrice * quantity;
    const costAmountLocal = avgPrice * quantity;

    const evalAmountKRW = currency === "USD" ? evalAmountLocal * usdKrw : evalAmountLocal;
    const costAmountKRW = currency === "USD" ? costAmountLocal * usdKrw : costAmountLocal;

    const returnRate =
      costAmountLocal > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

    return {
      stockId,
      ticker,
      name,
      market,
      category,
      sector,
      broker,
      quantity,
      avgPrice,
      currentPrice,
      currency,
      evalAmountKRW,
      costAmountKRW,
      returnRate,
      priceDate,
    };
  });

  const totalEvalKRW = holdings.reduce((s, h) => s + h.evalAmountKRW, 0);
  const totalCostKRW = holdings.reduce((s, h) => s + h.costAmountKRW, 0);
  const totalReturnRate =
    totalCostKRW > 0 ? ((totalEvalKRW - totalCostKRW) / totalCostKRW) * 100 : 0;

  const coreKRW = holdings.filter((h) => h.category === "Core").reduce((s, h) => s + h.evalAmountKRW, 0);
  const satelliteKRW = holdings.filter((h) => h.category === "Satellite").reduce((s, h) => s + h.evalAmountKRW, 0);

  const alpha = benchmarkReturn !== null ? totalReturnRate - benchmarkReturn : null;

  const contribData = holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    weightPct: totalEvalKRW > 0 ? (h.evalAmountKRW / totalEvalKRW) * 100 : 0,
    pnlKRW: h.evalAmountKRW - h.costAmountKRW,
    category: h.category,
    sector: h.sector,
  }));

  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const s = h.sector || "기타";
    sectorMap.set(s, (sectorMap.get(s) ?? 0) + h.evalAmountKRW);
  }
  const sectorData = Array.from(sectorMap.entries())
    .map(([sector, valueKRW]) => ({
      sector,
      valueKRW,
      pct: totalEvalKRW > 0 ? (valueKRW / totalEvalKRW) * 100 : 0,
    }))
    .sort((a, b) => b.valueKRW - a.valueKRW);

  return {
    holdings,
    summary: {
      totalEvalKRW,
      totalCostKRW,
      totalReturnRate,
      usdKrw,
      fxDate,
      coreKRW,
      satelliteKRW,
      benchmarkReturn,
      alpha,
    },
    contribData,
    sectorData,
  };
}

async function fetchRecentSignals() {
  const rows = await db.run(sql`
    SELECT
      sg.id,
      s.ticker,
      s.name AS stock_name,
      sg.type,
      sg.severity,
      sg.description,
      sg.detected_at,
      sg.is_resolved
    FROM signals sg
    JOIN stocks s ON s.id = sg.stock_id
    ORDER BY
      sg.is_resolved ASC,
      CASE sg.severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC,
      sg.detected_at DESC
    LIMIT 5
  `);

  return rows.rows.map((r) => ({
    id: Number(r[0]),
    ticker: String(r[1]),
    stockName: String(r[2]),
    type: String(r[3]),
    severity: String(r[4]),
    description: String(r[5]),
    detectedAt: String(r[6]),
    isResolved: Number(r[7]),
  }));
}

async function fetchUnresolvedCount() {
  const rows = await db.run(sql`
    SELECT COUNT(*) AS cnt FROM signals
    WHERE is_resolved = 0 AND severity = 'HIGH'
  `);
  return Number(rows.rows[0]?.[0] ?? 0);
}

async function fetchActivityTimeline(): Promise<ActivityItem[]> {
  const tradeRows = await db.run(sql`
    SELECT tj.traded_at, tj.action, tj.quantity, tj.price, tj.currency,
           s.ticker, s.name
    FROM trade_journal tj
    JOIN stocks s ON s.id = tj.stock_id
    ORDER BY tj.traded_at DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  const discRows = await db.run(sql`
    SELECT d.filed_at, d.title, d.source, s.ticker, s.name
    FROM disclosures d
    JOIN stocks s ON s.id = d.stock_id
    ORDER BY d.filed_at DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  const merged: ActivityItem[] = [
    ...tradeRows.rows.map((r) => ({
      kind: "trade" as const,
      at: String(r[0]),
      title: `${String(r[1])} ${Number(r[2]).toLocaleString()}주 @ ${Number(r[3]).toLocaleString()}`,
      detail: String(r[4]),
      ticker: String(r[5]),
      stockName: String(r[6]),
      href: "/journal",
    })),
    ...discRows.rows.map((r) => ({
      kind: "disclosure" as const,
      at: String(r[0]),
      title: String(r[1]),
      detail: String(r[2]),
      ticker: String(r[3]),
      stockName: String(r[4]),
      href: "/disclosures",
    })),
  ];

  merged.sort((a, b) => b.at.localeCompare(a.at));
  return merged.slice(0, 10);
}

async function fetchLoans() {
  const rows = await db.run(sql`
    SELECT
      l.id, s.ticker, l.label, l.loan_amount, l.interest_rate,
      l.started_at, l.is_active, l.note
    FROM stock_loans l
    LEFT JOIN stocks s ON s.id = l.stock_id
    WHERE l.is_active = 1
    ORDER BY l.created_at DESC
  `).catch(() => ({ rows: [] }));
  return rows.rows.map((r) => ({
    id: Number(r[0]),
    ticker: r[1] ? String(r[1]) : null,
    label: String(r[2]),
    loanAmount: Number(r[3]),
    interestRate: Number(r[4]),
    startedAt: r[5] ? String(r[5]) : null,
    isActive: Number(r[6]),
    note: r[7] ? String(r[7]) : null,
    annualInterest: Number(r[3]) * Number(r[4]) / 100,
    monthlyInterest: Number(r[3]) * Number(r[4]) / 100 / 12,
  }));
}

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [rawData, recentSignals, unresolvedCount, loans, netWorth, activityItems, displayCurrency] =
    await Promise.all([
      fetchDashboardData(),
      fetchRecentSignals(),
      fetchUnresolvedCount(),
      fetchLoans(),
      computeNetWorth().catch(() => null),
      fetchActivityTimeline(),
      fetchDisplayCurrency(),
    ]);
  const { contribData, sectorData, ...data } = rawData;

  return (
    <AppPageLayout
      wide
      email={session.user?.email}
      title=""
      subtitle=""
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient
          data={data}
          recentSignals={recentSignals}
          contribData={contribData}
          sectorData={sectorData}
          loans={loans}
          activityItems={activityItems}
          baseCurrency={displayCurrency.baseCurrency}
          fxRates={displayCurrency.fx}
        />
      </Suspense>
    </AppPageLayout>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-16 card-sws" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 card-sws" />
        ))}
      </div>
      <div className="h-44 card-sws" />
    </div>
  );
}
