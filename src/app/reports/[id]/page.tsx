import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import ReportDetailClient from "./ReportDetailClient";

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
  return {
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    trigger: String(r[4]),
    generatedAt: String(r[5]),
    contentMd: String(r[6]),
    chartsJson: r[7] ? String(r[7]) : null,
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
