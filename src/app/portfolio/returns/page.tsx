import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import { Suspense } from "react";
import ReturnsClient from "./ReturnsClient";
import PortfolioSubNav from "@/components/PortfolioSubNav";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // stocks + holdings 기본 쿼리
  const rows = await db.run(sql`
    SELECT
      vp.ticker,
      vp.name,
      vp.market,
      vp.quantity,
      vp.avg_price,
      (SELECT p.close_price FROM prices p WHERE p.stock_id = s.id ORDER BY p.date DESC LIMIT 1) AS current_price,
      vp.currency
    FROM v_portfolio vp
    JOIN stocks s ON s.ticker = vp.ticker
  `);

  const holdings = rows.rows.map((r) => ({
    ticker: String(r[0]),
    name: String(r[1]),
    market: String(r[2]),
    quantity: Number(r[3]),
    avgPrice: r[4] != null ? Number(r[4]) : null,
    currentPrice: r[5] != null ? Number(r[5]) : null,
    currency: String(r[6]),
  }));

  return (
    <AppPageLayout
      email={session.user?.email}
      title="Returns"
      subtitle="보유 종목 수익률 분석"
      wide
      subNav={<PortfolioSubNav />}
    >
      <Suspense fallback={<p className="text-sm text-text-muted">불러오는 중…</p>}>
        <ReturnsClient holdings={holdings} />
      </Suspense>
    </AppPageLayout>
  );
}
