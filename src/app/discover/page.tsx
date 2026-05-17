import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import DiscoverTabs from "./DiscoverTabs";

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
    <div className="min-h-screen bg-bg-base">
      <Navbar email={session.user?.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">종목 발굴</h1>
          <p className="text-text-muted text-sm mt-1">
            관심종목 체크리스트 · AI 스코어보드로 투자 기회를 발굴하세요
          </p>
        </div>
        <DiscoverTabs stocks={stocks} />
      </main>
    </div>
  );
}
