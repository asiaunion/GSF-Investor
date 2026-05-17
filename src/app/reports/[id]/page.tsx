import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import ReportDetailClient from "./ReportDetailClient";
import { factCheckReport, type FinancialData, type FactCheckResult } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export type ReportDetail = {
  id: number;
  stockId: number;
  ticker: string;
  stockName: string;
  trigger: string;
  generatedAt: string;
  contentMd: string;
  chartsJson: string | null;
  factCheck: FactCheckResult | null;
};

async function fetchReport(id: number): Promise<ReportDetail | null> {
  const rows = await db.run(sql`
    SELECT
      r.id,
      r.stock_id,
      s.ticker,
      s.name AS stock_name,
      r.trigger,
      r.generated_at,
      r.content_md,
      r.charts_json
    FROM reports r
    JOIN stocks s ON s.id = r.stock_id
    WHERE r.id = ${id}
  `);

  if (!rows.rows.length) return null;
  const r = rows.rows[0];
  const stockId = Number(r[1]);
  const contentMd = String(r[6]);

  // ── C-3: 팩트체크 — 재무수치 교차검증 ─────────────────────────
  const finRows = await db.run(sql`
    SELECT period, revenue, op_income, net_income, debt_ratio, eps, bps, roe, dividend_per_share, free_cash_flow, source
    FROM financials
    WHERE stock_id = ${stockId}
    ORDER BY period DESC LIMIT 4
  `);
  const financials: FinancialData[] = finRows.rows.map((fr) => ({
    period: String(fr[0] ?? ""),
    revenue: fr[1] != null ? Number(fr[1]) : null,
    opIncome: fr[2] != null ? Number(fr[2]) : null,
    netIncome: fr[3] != null ? Number(fr[3]) : null,
    debtRatio: fr[4] != null ? Number(fr[4]) : null,
    eps: fr[5] != null ? Number(fr[5]) : null,
    bps: fr[6] != null ? Number(fr[6]) : null,
    roe: fr[7] != null ? Number(fr[7]) : null,
    dividendPerShare: fr[8] != null ? Number(fr[8]) : null,
    freeCashFlow: fr[9] != null ? Number(fr[9]) : null,
    source: String(fr[10] ?? ""),
  }));

  const factCheck = financials.length > 0 ? factCheckReport(contentMd, financials) : null;

  return {
    id: Number(r[0]),
    stockId,
    ticker: String(r[2]),
    stockName: String(r[3]),
    trigger: String(r[4]),
    generatedAt: String(r[5]),
    contentMd,
    chartsJson: r[7] ? String(r[7]) : null,
    factCheck,
  };
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const report = await fetchReport(Number(id));
  if (!report) notFound();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar email={session.user?.email} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportDetailClient report={report} />
      </main>
    </div>
  );
}
