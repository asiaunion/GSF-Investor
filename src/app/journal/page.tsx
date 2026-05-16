import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import JournalList from "./JournalList";
import JournalFormToggle from "./JournalFormToggle";

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

  // 감정 태그별 통계
  const emotionStats = rows.reduce<Record<string, number>>((acc, r) => {
    if (r.emotionTag) acc[r.emotionTag] = (acc[r.emotionTag] ?? 0) + 1;
    return acc;
  }, {});

  const emotionColors: Record<string, string> = {
    확신: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    계획적: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    불안: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    충동: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const buyCount = rows.filter((r) => r.action === "BUY").length;
  const sellCount = rows.filter((r) => r.action === "SELL").length;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* 네비게이션 */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-zinc-300">GSF Investor</span>
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-sm font-medium text-white">매매 일지</span>
          </div>
          <span className="text-xs text-zinc-500 hidden sm:block">{session.user?.email}</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">매매 일지</h1>
            <p className="text-zinc-500 text-sm mt-1">
              총 {rows.length}건 · 매수 {buyCount}건 · 매도 {sellCount}건
            </p>
          </div>
          <JournalFormToggle />
        </div>

        {/* 감정 태그 통계 */}
        {Object.keys(emotionStats).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(emotionStats).map(([tag, count]) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${emotionColors[tag] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}
              >
                {tag}
                <span className="opacity-60">×{count}</span>
              </span>
            ))}
          </div>
        )}

        {/* 리스트 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <JournalList rows={rows} />
        </div>
      </main>
    </div>
  );
}
