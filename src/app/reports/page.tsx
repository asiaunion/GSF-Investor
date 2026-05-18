import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export type ReportRow = {
  id: number;
  stockId: number;
  ticker: string;
  stockName: string;
  trigger: string;
  generatedAt: string;
  preview: string;
};

export type StockOption = {
  id: number;
  ticker: string;
  name: string;
};

async function fetchReports(): Promise<ReportRow[]> {
  const rows = await db.run(sql`
    SELECT
      r.id,
      r.stock_id,
      s.ticker,
      s.name AS stock_name,
      r.trigger,
      r.generated_at,
      SUBSTR(r.content_md, 1, 800) AS preview
    FROM reports r
    JOIN stocks s ON s.id = r.stock_id
    ORDER BY r.generated_at DESC
    LIMIT 50
  `);

  return rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    trigger: String(r[4]),
    generatedAt: String(r[5]),
    preview: String(r[6]),
  }));
}

async function fetchStocks(): Promise<StockOption[]> {
  const rows = await db.run(sql`
    SELECT id, ticker, name FROM stocks WHERE is_active = 1 ORDER BY ticker
  `);
  return rows.rows.map((r) => ({
    id: Number(r[0]),
    ticker: String(r[1]),
    name: String(r[2]),
  }));
}

export default async function ReportsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [reports, stocks] = await Promise.all([fetchReports(), fetchStocks()]);

  return (
    <AppPageLayout
      email={session.user?.email}
      title="AI 분석 보고서"
      subtitle="Gemini AI 기반 종목 분석 — 스트리밍 생성 지원"
    >
      <ReportsClient reports={reports} stocks={stocks} />
    </AppPageLayout>
  );
}
