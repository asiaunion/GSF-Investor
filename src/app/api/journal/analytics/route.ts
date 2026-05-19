import { auth } from "@/auth";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  dailyReturns,
  maxDrawdownPct,
  periodReturnPct,
  sharpeRatio,
  volatilityAnnualized,
} from "@/lib/performance-metrics";
import {
  aggregateEmotionStats,
  computeFifoRealizedTrades,
  type TradeRow,
} from "@/lib/fifo";

const EMOTIONS = ["확신", "계획적", "불안", "충동"];

/**
 * FIFO 방식으로 BUY/INIT 매칭 → SELL 실현 손익 계산
 * 감정 태그별 집계도 반환
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: tradeJournal.id,
      stockId: tradeJournal.stockId,
      ticker: stocks.ticker,
      name: stocks.name,
      tradedAt: tradeJournal.tradedAt,
      action: tradeJournal.action,
      quantity: tradeJournal.quantity,
      price: tradeJournal.price,
      currency: tradeJournal.currency,
      category: tradeJournal.category,
      emotionTag: tradeJournal.emotionTag,
      loanInterest: tradeJournal.loanInterest,
    })
    .from(tradeJournal)
    .leftJoin(stocks, eq(tradeJournal.stockId, stocks.id))
    .orderBy(asc(tradeJournal.tradedAt));

  const tradeRows: TradeRow[] = rows
    .filter((r) => r.stockId != null)
    .map((r) => ({
      id: r.id,
      stockId: r.stockId!,
      tradedAt: r.tradedAt,
      action: r.action as TradeRow["action"],
      quantity: r.quantity,
      price: r.price,
      currency: r.currency,
      emotionTag: r.emotionTag,
      loanInterest: r.loanInterest,
    }));

  const fifoRealized = computeFifoRealizedTrades(tradeRows);
  const stockLookup = new Map(
    rows.filter((r) => r.stockId).map((r) => [r.stockId!, { ticker: r.ticker, name: r.name }])
  );

  const realizedTrades = fifoRealized.map((t) => {
    const meta = stockLookup.get(t.stockId);
    return {
      ...t,
      ticker: meta?.ticker ?? null,
      name: meta?.name ?? null,
    };
  });

  const emotionMap = aggregateEmotionStats(tradeRows, fifoRealized, EMOTIONS);
  const emotionStats = EMOTIONS.map((t) => emotionMap[t]).filter((s) => s.count > 0);

  const totalRealizedPnl = realizedTrades.reduce((s, t) => s + t.realizedPnl, 0);
  const totalLoanInterest = realizedTrades.reduce((s, t) => s + t.loanInterest, 0);
  const totalNetPnl = realizedTrades.reduce((s, t) => s + t.netPnl, 0);
  const winTrades = realizedTrades.filter((t) => t.netPnl > 0).length;
  const totalSells = realizedTrades.length;

  const coreRows = rows.filter((r) => r.category === "Core");
  const satelliteRows = rows.filter((r) => r.category === "Satellite");

  let benchmarkPerformance: {
    ticker: string;
    periodReturnPct: number | null;
    volatilityPct: number | null;
    maxDrawdownPct: number | null;
    sharpe: number | null;
  } | null = null;

  const benchPriceRows = await db.run(sql`
    SELECT p.close_price FROM prices p
    JOIN stocks s ON s.id = p.stock_id
    WHERE s.ticker = '069500'
    ORDER BY p.date ASC
    LIMIT 252
  `);
  if (benchPriceRows.rows.length >= 2) {
    const closes = benchPriceRows.rows.map((r) => Number(r[0]));
    const rets = dailyReturns(closes);
    benchmarkPerformance = {
      ticker: "069500",
      periodReturnPct: periodReturnPct(closes),
      volatilityPct: volatilityAnnualized(rets),
      maxDrawdownPct: maxDrawdownPct(closes),
      sharpe: sharpeRatio(rets),
    };
  }

  return NextResponse.json({
    summary: {
      totalTrades: rows.filter((r) => r.action !== "INIT").length,
      buyCount: rows.filter((r) => r.action === "BUY").length,
      sellCount: rows.filter((r) => r.action === "SELL").length,
      totalRealizedPnl,
      totalLoanInterest,
      totalNetPnl,
      winRate: totalSells > 0 ? (winTrades / totalSells) * 100 : null,
      winTrades,
      lossTrades: totalSells - winTrades,
    },
    emotionStats,
    realizedTrades: realizedTrades.slice(-20).reverse(),
    categoryBreakdown: {
      core: coreRows.filter((r) => r.action !== "INIT").length,
      satellite: satelliteRows.filter((r) => r.action !== "INIT").length,
    },
    benchmarkPerformance,
  });
}
