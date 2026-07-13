import ResearchSubNav from "@/components/ResearchSubNav";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
import DiscoverTabs from "@/app/discover/DiscoverTabs";

export const dynamic = "force-dynamic";

export type StockWithChecklist = {
  id: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  isActive: number;
  addedAt: string;
};

async function fetchStocks(): Promise<StockWithChecklist[]> {
  const rows = await db.run(sql`
    SELECT id, ticker, name, market, category, is_active, added_at
    FROM stocks
    ORDER BY added_at DESC
  `);
  return rows.rows.map((r) => ({
    id: Number(r[0]),
    ticker: String(r[1]),
    name: String(r[2]),
    market: String(r[3]),
    category: String(r[4]),
    isActive: Number(r[5]),
    addedAt: String(r[6]),
  }));
}

export default async function DiscoverPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const stocks = await fetchStocks();

  return (
    <AppPageLayout
       wide
      subNav={<ResearchSubNav />}
      email={session.user?.email}
      title="Screening"
      subtitle="체크리스트·AI 스코어보드로 투자 기회를 발굴하세요"
    >
      <Suspense fallback={<p className="text-sm text-text-muted">불러오는 중…</p>}>
        <DiscoverTabs stocks={stocks} />
      </Suspense>
    </AppPageLayout>
  );
}
