import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

// ── 데이터 페칭 (Server Side) ─────────────────────────────────────────────────
async function fetchDashboardData() {
  // v_portfolio
  const portfolioRows = await db.run(sql`
    SELECT stock_id, ticker, name, category, broker, quantity, avg_price, currency
    FROM v_portfolio
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

  const holdings = portfolioRows.rows.map((row) => {
    const stockId = Number(row[0]);
    const ticker = String(row[1]);
    const name = String(row[2]);
    const category = String(row[3]);
    const broker = row[4] ? String(row[4]) : null;
    const quantity = Number(row[5]);
    const avgPrice = Number(row[6]);
    const currency = String(row[7]);

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

// ── 서버 컴포넌트 메인 ─────────────────────────────────────────────────────────
export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const data = await fetchDashboardData();

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Nav */}
      <nav className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm">GSF Investor</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-xs text-emerald-400 font-medium">대시보드</Link>
            <Link href="/journal" className="text-xs text-zinc-400 hover:text-white transition-colors">매매 일지</Link>
            <span className="text-xs text-zinc-600 hidden sm:block">{session.user?.email}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">포트폴리오 대시보드</h1>
          <p className="text-zinc-500 text-sm mt-1">
            기준일: {data.summary.fxDate ?? "—"} &nbsp;·&nbsp; USD/KRW {data.summary.usdkrw.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
          </p>
        </div>

        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardClient data={data} />
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
