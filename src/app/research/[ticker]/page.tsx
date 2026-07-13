import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import ResearchTickerClient from "./ResearchTickerClient";

export default async function ResearchTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { ticker } = await params;

  const stockRows = await db.run(sql`SELECT id FROM stocks WHERE ticker = ${ticker} LIMIT 1`);
  if (stockRows.rows.length === 0) {
    return (
      <AppPageLayout
        email={session.user?.email}
        title={ticker.toUpperCase()}
        subtitle="종목 딥다이브 — Thesis · AI Report · Signals · Notes"
      >
        <div className="py-24 text-center text-text-muted">종목을 찾을 수 없습니다.</div>
      </AppPageLayout>
    );
  }
  const stockId = Number(stockRows.rows[0][0]);

  const thesisRows = await db.run(sql`
    SELECT action, conviction, fair_value_local, expected_return_pct, next_catalyst, thesis_summary 
    FROM stock_thesis 
    WHERE stock_id = ${stockId}
  `);

  let initialThesis = null;
  if (thesisRows.rows.length > 0) {
    const r = thesisRows.rows[0];
    initialThesis = {
      action: String(r[0]),
      conviction: r[1] ? String(r[1]) : null,
      fairValueLocal: r[2] != null ? Number(r[2]) : null,
      expectedReturnPct: r[3] != null ? Number(r[3]) : null,
      nextCatalyst: r[4] ? String(r[4]) : null,
      thesisSummary: r[5] ? String(r[5]) : null,
    };
  }

  return (
    <AppPageLayout
      email={session.user?.email}
      title={ticker.toUpperCase()}
      subtitle="종목 딥다이브 — Thesis · AI Report · Signals · Notes"
    >
      <ResearchTickerClient stockId={stockId} initialThesis={initialThesis} />
    </AppPageLayout>
  );
}
