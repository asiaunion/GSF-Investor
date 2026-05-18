import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import DisclosuresClient from "./DisclosuresClient";

export const dynamic = "force-dynamic";

export type DisclosureRow = {
  id: number;
  stockId: number;
  ticker: string;
  stockName: string;
  market: string;
  source: string;
  filedAt: string;
  title: string;
  summaryAi: string | null;
  rawUrl: string | null;
  rcpNo: string | null;
  fetchedAt: string;
};

async function fetchDisclosures(): Promise<DisclosureRow[]> {
  const rows = await db.run(sql`
    SELECT
      d.id,
      d.stock_id,
      s.ticker,
      s.name AS stock_name,
      s.market,
      d.source,
      d.filed_at,
      d.title,
      d.summary_ai,
      d.raw_url,
      d.rcp_no,
      d.fetched_at
    FROM disclosures d
    JOIN stocks s ON s.id = d.stock_id
    ORDER BY d.filed_at DESC, d.fetched_at DESC
    LIMIT 200
  `);

  return rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: Number(r[1]),
    ticker: String(r[2]),
    stockName: String(r[3]),
    market: String(r[4]),
    source: String(r[5]),
    filedAt: String(r[6]),
    title: String(r[7]),
    summaryAi: r[8] ? String(r[8]) : null,
    rawUrl: r[9] ? String(r[9]) : null,
    rcpNo: r[10] ? String(r[10]) : null,
    fetchedAt: String(r[11]),
  }));
}

async function fetchTickers(): Promise<string[]> {
  const rows = await db.run(sql`
    SELECT DISTINCT s.ticker
    FROM disclosures d
    JOIN stocks s ON s.id = d.stock_id
    ORDER BY s.ticker
  `);
  return rows.rows.map((r) => String(r[0]));
}

export default async function DisclosuresPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [disclosures, tickers] = await Promise.all([
    fetchDisclosures(),
    fetchTickers(),
  ]);

  return (
    <AppPageLayout
      email={session.user?.email}
      title="공시 타임라인"
      subtitle="DART · SEC EDGAR 최신 공시 — 최대 200건"
    >
      <DisclosuresClient disclosures={disclosures} tickers={tickers} />
    </AppPageLayout>
  );
}
