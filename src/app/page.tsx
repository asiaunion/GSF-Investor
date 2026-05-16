import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Suspense } from "react";
import DashboardClient from "./DashboardClient";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── 데이터 페칭 (Server Side) ─────────────────────────────────────────────────
// 실제 v_portfolio 컬럼: ticker, name, market, category, broker, quantity, avg_price, currency
async function fetchDashboardData() {
  // v_portfolio + stocks JOIN → stock_id 확보
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
      vp.currency
    FROM v_portfolio vp
    JOIN stocks s ON s.ticker = vp.ticker
  `);

  // 최신 종가
  const latestPricesRows = await db.run(sql`
    SELECT p.stock_id, p.close_price, p.currency, p.date
    FROM prices p
    INNER JOIN (
      SELECT stock_id, MAX(date) AS max_date FROM prices GROUP BY stock_id
    ) latest ON p.stock_id = latest.stock_id AND p.date = latest.max_date
  `);

  // 최신 환율
  const fxRow = await db.run(sql`
    SELECT rate, date FROM exchange_rates WHERE pair = 'USDKRW'
    ORDER BY date DESC LIMIT 1
  `);

  const latestPriceMap = new Map<number, { closePrice: number; currency: string; date: string }>();
  for (const row of latestPricesRows.rows) {
    latestPriceMap.set(Number(row[0]), {
      closePrice: Number(row[1]),
      currency: String(row[2]),
      date: String(row[3]),
    });
  }

  const usdkrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;
  const fxDate = fxRow.rows.length > 0 ? String(fxRow.rows[0][1]) : null;

  // 컬럼 인덱스: stock_id(0), ticker(1), name(2), market(3), category(4), broker(5), quantity(6), avg_price(7), currency(8)
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

    const latest = latestPriceMap.get(stockId);
    const currentPrice = latest?.closePrice ?? avgPrice;
    const priceDate = latest?.date ?? null;

    const evalAmountLocal = currentPrice * quantity;
    const costAmountLocal = avgPrice * quantity;

    const evalAmountKRW = currency === "USD" ? evalAmountLocal * usdkrw : evalAmountLocal;
    const costAmountKRW = currency === "USD" ? costAmountLocal * usdkrw : costAmountLocal;

    const returnRate =
      costAmountLocal > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

    return {
      stockId,
      ticker,
      name,
      market,
      category,
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

  return {
    holdings,
    summary: { totalEvalKRW, totalCostKRW, totalReturnRate, usdkrw, fxDate, coreKRW, satelliteKRW },
  };
}

// ── 최근 시그널 (최신 5건, HIGH 우선) ─────────────────────────────────────────
async function fetchRecentSignals() {
  const rows = await db.run(sql`
    SELECT
      sg.id,
      s.ticker,
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
    type: String(r[2]),
    severity: String(r[3]),
    description: String(r[4]),
    detectedAt: String(r[5]),
    isResolved: Number(r[6]),
  }));
}

async function fetchUnresolvedCount() {
  const rows = await db.run(sql`
    SELECT COUNT(*) AS cnt FROM signals
    WHERE is_resolved = 0 AND severity = 'HIGH'
  `);
  return Number(rows.rows[0]?.[0] ?? 0);
}

// ── 서버 컴포넌트 메인 ─────────────────────────────────────────────────────────
export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [data, recentSignals, unresolvedCount] = await Promise.all([
    fetchDashboardData(),
    fetchRecentSignals(),
    fetchUnresolvedCount(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar email={session.user?.email} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              포트폴리오 대시보드
              {unresolvedCount > 0 && (
                <Link
                  href="/signals"
                  className="inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-red-500/25 transition-colors animate-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  미확인 시그널 {unresolvedCount}건
                </Link>
              )}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              기준일: {data.summary.fxDate ?? "—"} &nbsp;·&nbsp; USD/KRW {data.summary.usdkrw.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardClient data={data} recentSignals={recentSignals} />
        </Suspense>
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 bg-zinc-900 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-72 bg-zinc-900 rounded-2xl" />
        <div className="h-72 bg-zinc-900 rounded-2xl" />
      </div>
    </div>
  );
}
