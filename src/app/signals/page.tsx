import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import SignalsClient from "./SignalsClient";

export const dynamic = "force-dynamic";

export type SignalRow = {
  id: number;
  stockId: number;
  ticker: string;
  stockName: string;
  detectedAt: string;
  type: string;
  severity: string;
  description: string;
  isResolved: number;
  resolvedNote: string | null;
};

async function fetchSignals(): Promise<SignalRow[]> {
  const rows = await db.run(sql`
    SELECT
      sg.id,
      sg.stock_id,
      s.ticker,
      s.name AS stock_name,
      sg.detected_at,
      sg.type,
      sg.severity,
      sg.description,
      sg.is_resolved,
      sg.resolved_note
    FROM signals sg
    JOIN stocks s ON s.id = sg.stock_id
    ORDER BY
      sg.is_resolved ASC,          -- 미확인 먼저
      CASE sg.severity
        WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'LOW' THEN 3
        ELSE 4
      END ASC,                      -- HIGH 우선
      sg.detected_at DESC
    LIMIT 500
  `);

  return rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    detectedAt: String(r[4]),
    type: String(r[5]),
    severity: String(r[6]),
    description: String(r[7]),
    isResolved: Number(r[8]),
    resolvedNote: r[9] ? String(r[9]) : null,
  }));
}

export default async function SignalsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const signals = await fetchSignals();
  const unresolvedCount = signals.filter((s) => s.isResolved === 0 && s.severity === "HIGH").length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar email={session.user?.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              시그널 타임라인
              {unresolvedCount > 0 && (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                  {unresolvedCount}
                </span>
              )}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              HIGH 우선 정렬 · 미확인 시그널 먼저 표시
            </p>
          </div>
        </div>
        <SignalsClient signals={signals} />
      </main>
    </div>
  );
}
