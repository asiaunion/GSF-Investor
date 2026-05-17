import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import JournalList from "./JournalList";
import JournalFormToggle from "./JournalFormToggle";
import JournalTabs from "./JournalTabs";

export const metadata = {
  title: "매매 일지 — GSF Investor",
};

export default async function JournalPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rows = await db
    .select({
      id: tradeJournal.id,
      stockId: tradeJournal.stockId,
      ticker: stocks.ticker,
      name: stocks.name,
      market: stocks.market,
      tradedAt: tradeJournal.tradedAt,
      action: tradeJournal.action,
      quantity: tradeJournal.quantity,
      price: tradeJournal.price,
      currency: tradeJournal.currency,
      thesis: tradeJournal.thesis,
      emotionTag: tradeJournal.emotionTag,
      createdAt: tradeJournal.createdAt,
    })
    .from(tradeJournal)
    .leftJoin(stocks, eq(tradeJournal.stockId, stocks.id))
    .orderBy(desc(tradeJournal.tradedAt));

  const buyCount = rows.filter((r) => r.action === "BUY").length;
  const sellCount = rows.filter((r) => r.action === "SELL").length;

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar email={session.user?.email} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">매매 일지</h1>
            <p className="text-text-muted text-sm mt-1">
              총 {rows.length}건 · 매수 {buyCount}건 · 매도 {sellCount}건
            </p>
          </div>
          <JournalFormToggle />
        </div>

        {/* 탭 패널 (일지 목록 | 분석 대시보드) */}
        <JournalTabs rows={rows} />
      </main>
    </div>
  );
}
