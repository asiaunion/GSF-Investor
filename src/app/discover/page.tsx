import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import DiscoverClient from "./DiscoverClient";

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
    <div className="min-h-screen bg-zinc-950">
      <Navbar email={session.user?.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">종목 발굴</h1>
          <p className="text-zinc-500 text-sm mt-1">
            수동 종목 추가 + 6개 체크리스트 자동 검증 · AI 패턴 매칭은 Phase 4
          </p>
        </div>
        <DiscoverClient stocks={stocks} />
      </main>
    </div>
  );
}
