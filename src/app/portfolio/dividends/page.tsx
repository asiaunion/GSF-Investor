import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import { fetchDisplayCurrency } from "@/lib/display-currency";
import DividendsClient, { type DividendRow } from "@/app/dividends/DividendsClient";

export const dynamic = "force-dynamic";

async function fetchDividends(): Promise<DividendRow[]> {
  const rows = await db.run(sql`
    SELECT
      d.id,
      s.ticker,
      s.name AS stock_name,
      d.ex_date,
      d.pay_date,
      d.amount_per_share,
      d.currency,
      d.source,
      COALESCE(vp.quantity, 0) AS quantity
    FROM dividend_events d
    JOIN stocks s ON s.id = d.stock_id
    LEFT JOIN v_portfolio vp ON vp.ticker = s.ticker
    WHERE d.ex_date IS NOT NULL
      AND d.ex_date >= date('now', '-730 days')
    ORDER BY d.ex_date DESC
    LIMIT 500
  `).catch(() => ({ rows: [] }));

  return rows.rows.map((r) => {
    const qty = Number(r[8]);
    return {
      id: Number(r[0]),
      ticker: String(r[1]),
      stockName: String(r[2]),
      exDate: String(r[3]),
      payDate: r[4] ? String(r[4]) : null,
      amountPerShare: Number(r[5]),
      currency: String(r[6]),
      source: r[7] ? String(r[7]) : null,
      isHeld: qty > 0,
      quantity: qty,
    };
  });
}

export default async function DividendsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [dividends, displayCurrency] = await Promise.all([
    fetchDividends(),
    fetchDisplayCurrency(),
  ]);

  const heldCount = dividends.filter((d) => d.isHeld).length;

  return (
    <AppPageLayout
      email={session.user?.email}
      title="Dividends"
      subtitle={
        dividends.length > 0
          ? `${dividends.length}건 · 보유 연관 ${heldCount}건 · yfinance 배당락`
          : "배당 일정 — cron 또는 수동 적재 후 표시"
      }
    >
      <DividendsClient
        rows={dividends}
        baseCurrency={displayCurrency.baseCurrency}
        fxRates={displayCurrency.fx}
      />
    </AppPageLayout>
  );
}
