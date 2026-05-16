import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import JournalDetailClient from "./JournalDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `매매 일지 #${id} — GSF Investor` };
}

export default async function JournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [row] = await db
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
      category: tradeJournal.category,
      emotionTag: tradeJournal.emotionTag,
      retrospective: tradeJournal.retrospective,
      createdAt: tradeJournal.createdAt,
    })
    .from(tradeJournal)
    .leftJoin(stocks, eq(tradeJournal.stockId, stocks.id))
    .where(eq(tradeJournal.id, Number(id)));

  if (!row) notFound();

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* 네비게이션 */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/" className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </Link>
          <span className="text-zinc-700">/</span>
          <Link href="/journal" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            매매 일지
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-white font-medium">
            {row.ticker} — {row.tradedAt}
          </span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <JournalDetailClient initial={row} />
      </main>
    </div>
  );
}
