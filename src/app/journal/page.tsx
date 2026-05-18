import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import AppPageLayout from "@/components/AppPageLayout";
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
    <AppPageLayout
      email={session.user?.email}
      title="매매 일지"
      subtitle={`총 ${rows.length}건 · 매수 ${buyCount}건 · 매도 ${sellCount}건`}
      headerExtra={<JournalFormToggle />}
    >
      <JournalTabs rows={rows} buyCount={buyCount} sellCount={sellCount} />
    </AppPageLayout>
  );
}
