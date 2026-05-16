import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import SettingsClient from "./SettingsClient";
import Navbar from "@/components/Navbar";

export const dynamic = "force-dynamic";

export type StockSetting = {
  id: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  broker: string;
  thesis: string;
  yahooTicker: string;
  dartCorpCode: string;
  secCik: string;
  isActive: number;
  addedAt: string;
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rows = await db.run(sql`
    SELECT id, ticker, name, market, category, broker, thesis,
           yahoo_ticker, dart_corp_code, sec_cik, is_active, added_at
    FROM stocks
    ORDER BY is_active DESC, category, ticker
  `);

  const stocks: StockSetting[] = rows.rows.map((r) => ({
    id: Number(r[0]),
    ticker: String(r[1]),
    name: String(r[2]),
    market: String(r[3]),
    category: String(r[4]),
    broker: r[5] ? String(r[5]) : "",
    thesis: r[6] ? String(r[6]) : "",
    yahooTicker: r[7] ? String(r[7]) : "",
    dartCorpCode: r[8] ? String(r[8]) : "",
    secCik: r[9] ? String(r[9]) : "",
    isActive: Number(r[10]),
    addedAt: String(r[11]),
  }));

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar email={session.user?.email} />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">⚙️ 설정</h1>
          <p className="text-sm text-zinc-500 mt-1">관심종목 관리 및 식별자 설정</p>
        </div>
        <SettingsClient stocks={stocks} />
      </div>
    </div>
  );
}
