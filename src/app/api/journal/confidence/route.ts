import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, asc, isNotNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // confidence_score가 있는 레코드만 날짜순으로 조회
  const rows = await db
    .select({
      id: tradeJournal.id,
      ticker: stocks.ticker,
      name: stocks.name,
      tradedAt: tradeJournal.tradedAt,
      action: tradeJournal.action,
      confidenceScore: tradeJournal.confidenceScore,
      emotionTag: tradeJournal.emotionTag,
    })
    .from(tradeJournal)
    .leftJoin(stocks, eq(tradeJournal.stockId, stocks.id))
    .where(isNotNull(tradeJournal.confidenceScore))
    .orderBy(asc(tradeJournal.tradedAt));

  // 날짜별 평균 확신도 집계 (같은 날 여러 건이면 평균)
  const dateMap = new Map<
    string,
    { scores: number[]; entries: typeof rows }
  >();
  for (const row of rows) {
    const date = row.tradedAt.slice(0, 10);
    if (!dateMap.has(date)) dateMap.set(date, { scores: [], entries: [] });
    const entry = dateMap.get(date)!;
    entry.scores.push(row.confidenceScore!);
    entry.entries.push(row);
  }

  const trend = Array.from(dateMap.entries()).map(([date, { scores, entries }]) => ({
    date,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    count: scores.length,
    // 마지막 항목의 정보를 대표로 사용
    ticker: entries[entries.length - 1].ticker,
    stockName: entries[entries.length - 1].name,
    emotionTag: entries[entries.length - 1].emotionTag,
  }));

  return NextResponse.json({ trend, raw: rows });
}
