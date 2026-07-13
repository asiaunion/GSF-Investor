import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import { Suspense } from "react";
import ReturnsClient from "./ReturnsClient";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // stocks + holdings 기본 쿼리 (DashboardClient와 동일한 패턴 참고)
  const rows = await db.run(sql`
    SELECT
      s.ticker,
      s.name,
      s.market,
      COALESCE(SUM(tj.quantity * CASE WHEN tj.action = 'BUY' THEN 1 ELSE -1 END), 0) AS quantity,
      AVG(CASE WHEN tj.action = 'BUY' THEN tj.price END) AS avg_price,
      s.current_price,
      s.currency
    FROM stocks s
    LEFT JOIN trade_journal tj ON tj.stock_id = s.id
    WHERE s.is_active = 1
    GROUP BY s.id
    HAVING quantity > 0
    ORDER BY s.ticker
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
    >
      <Suspense fallback={<p className="text-sm text-text-muted">불러오는 중…</p>}>
        <ReturnsClient holdings={holdings} />
      </Suspense>
    </AppPageLayout>
  );
}
