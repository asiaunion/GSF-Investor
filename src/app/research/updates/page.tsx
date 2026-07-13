import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import UpdatesClient from "./UpdatesClient";
import type { SignalRow } from "@/app/signals/SignalsClient";
import type { DisclosureRow } from "@/app/disclosures/DisclosuresClient";

export const dynamic = "force-dynamic";

async function fetchSignals() {
  const rows = await db.run(sql`
    SELECT
      sg.id, sg.stock_id, s.ticker, s.name AS stock_name,
      sg.detected_at, sg.type, sg.severity, sg.description,
      sg.is_resolved, sg.resolved_note
    FROM signals sg
    JOIN stocks s ON s.id = sg.stock_id
    ORDER BY sg.detected_at DESC
    LIMIT 100
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
    resolvedNote: r[9] != null ? String(r[9]) : null,
  })) as SignalRow[];
}

async function fetchDisclosures() {
  const rows = await db.run(sql`
    SELECT
      d.id, d.stock_id, s.ticker, s.name AS stock_name, s.market,
      d.source, d.filed_at, d.title, d.summary_ai, d.raw_url
    FROM disclosures d
    JOIN stocks s ON s.id = d.stock_id
    ORDER BY d.filed_at DESC
    LIMIT 100
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
    summaryAi: r[8] != null ? String(r[8]) : null,
    rawUrl: r[9] != null ? String(r[9]) : null,
  })) as DisclosureRow[];
}

export default async function UpdatesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [signals, disclosures] = await Promise.all([fetchSignals(), fetchDisclosures()]);

  return (
    <AppPageLayout
      email={session.user?.email}
      title="Updates"
      subtitle="시그널 알림과 공시 업데이트"
      wide
    >
      <UpdatesClient signals={signals} disclosures={disclosures} />
    </AppPageLayout>
  );
}
