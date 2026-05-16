import { auth } from "@/auth";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * FIFO 방식으로 BUY/INIT 매칭 → SELL 실현 손익 계산
 * 감정 태그별 집계도 반환
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 전체 trade_journal 로드 (시간순)
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
    })
    .from(tradeJournal)
    .leftJoin(stocks, eq(tradeJournal.stockId, stocks.id))
    .orderBy(asc(tradeJournal.tradedAt));

  // ── 1. FIFO 실현 손익 계산 ─────────────────────────────────────────────────
  // stockId → FIFO 큐 [{qty, price}]
  const fifoQueues: Record<number, { qty: number; price: number; emotion: string | null }[]> = {};

  interface RealizedTrade {
    id: number;
    ticker: string | null;
    name: string | null;
    tradedAt: string;
    quantity: number;
    sellPrice: number;
    avgBuyPrice: number;
    realizedPnl: number;    // 실현 손익 (KRW)
    returnPct: number;      // 수익률 (%)
    currency: string | null;
    emotionTag: string | null; // SELL 시점의 감정
  }

  const realizedTrades: RealizedTrade[] = [];

  for (const row of rows) {
    if (!row.stockId) continue;
    const sid = row.stockId;
    if (!fifoQueues[sid]) fifoQueues[sid] = [];

    if (row.action === "BUY" || row.action === "INIT") {
      fifoQueues[sid].push({ qty: row.quantity, price: row.price, emotion: row.emotionTag });
    } else if (row.action === "SELL") {
      let remaining = row.quantity;
      let totalCost = 0;
      let matchedQty = 0;

      while (remaining > 0 && fifoQueues[sid].length > 0) {
        const head = fifoQueues[sid][0];
        const take = Math.min(head.qty, remaining);
        totalCost += take * head.price;
        matchedQty += take;
        remaining -= take;
        head.qty -= take;
        if (head.qty === 0) fifoQueues[sid].shift();
      }

      if (matchedQty > 0) {
        const avgBuyPrice = totalCost / matchedQty;
        const sellRevenue = row.quantity * row.price;
        const buyCost = matchedQty * avgBuyPrice;
        const realizedPnl = sellRevenue - buyCost;
        const returnPct = (realizedPnl / buyCost) * 100;

        realizedTrades.push({
          id: row.id,
          ticker: row.ticker,
          name: row.name,
          tradedAt: row.tradedAt,
          quantity: row.quantity,
          sellPrice: row.price,
          avgBuyPrice,
          realizedPnl,
          returnPct,
          currency: row.currency,
          emotionTag: row.emotionTag,
        });
      }
    }
  }

  // ── 2. 감정 태그별 집계 ────────────────────────────────────────────────────
  const EMOTIONS = ["확신", "계획적", "불안", "충동"];

  interface EmotionStat {
    tag: string;
    count: number;         // 총 거래 건수 (BUY+SELL+INIT)
    buyCount: number;
    sellCount: number;
    totalRealizedPnl: number;  // 해당 감정 SELL의 실현 손익 합계
    avgReturnPct: number | null; // 평균 수익률
    winCount: number;      // 수익 거래 수
    lossCount: number;     // 손실 거래 수
  }

  const emotionMap: Record<string, EmotionStat> = {};
  for (const tag of EMOTIONS) {
    emotionMap[tag] = {
      tag,
      count: 0,
      buyCount: 0,
      sellCount: 0,
      totalRealizedPnl: 0,
      avgReturnPct: null,
      winCount: 0,
      lossCount: 0,
    };
  }

  for (const row of rows) {
    if (!row.emotionTag || !emotionMap[row.emotionTag]) continue;
    const stat = emotionMap[row.emotionTag];
    stat.count++;
    if (row.action === "BUY" || row.action === "INIT") stat.buyCount++;
    if (row.action === "SELL") stat.sellCount++;
  }

  // SELL 기반 실현 손익 집계
  const sellReturnsByEmotion: Record<string, number[]> = {};
  for (const trade of realizedTrades) {
    if (!trade.emotionTag) continue;
    if (!sellReturnsByEmotion[trade.emotionTag]) sellReturnsByEmotion[trade.emotionTag] = [];
    sellReturnsByEmotion[trade.emotionTag].push(trade.returnPct);
    if (emotionMap[trade.emotionTag]) {
      emotionMap[trade.emotionTag].totalRealizedPnl += trade.realizedPnl;
      if (trade.realizedPnl > 0) emotionMap[trade.emotionTag].winCount++;
      else emotionMap[trade.emotionTag].lossCount++;
    }
  }

  for (const [tag, returns] of Object.entries(sellReturnsByEmotion)) {
    if (emotionMap[tag] && returns.length > 0) {
      emotionMap[tag].avgReturnPct = returns.reduce((a, b) => a + b, 0) / returns.length;
    }
  }

  const emotionStats = EMOTIONS.map((t) => emotionMap[t]).filter((s) => s.count > 0);

  // ── 3. 전체 요약 ──────────────────────────────────────────────────────────
  const totalRealizedPnl = realizedTrades.reduce((s, t) => s + t.realizedPnl, 0);
  const winTrades = realizedTrades.filter((t) => t.realizedPnl > 0).length;
  const totalSells = realizedTrades.length;

  // ── 4. 카테고리별 집계 ────────────────────────────────────────────────────
  const coreRows = rows.filter((r) => r.category === "Core");
  const satelliteRows = rows.filter((r) => r.category === "Satellite");

  return NextResponse.json({
    summary: {
      totalTrades: rows.filter((r) => r.action !== "INIT").length,
      buyCount: rows.filter((r) => r.action === "BUY").length,
      sellCount: rows.filter((r) => r.action === "SELL").length,
      totalRealizedPnl,
      winRate: totalSells > 0 ? (winTrades / totalSells) * 100 : null,
      winTrades,
      lossTrades: totalSells - winTrades,
    },
    emotionStats,
    realizedTrades: realizedTrades.slice(-20).reverse(), // 최신 20건
    categoryBreakdown: {
      core: coreRows.filter((r) => r.action !== "INIT").length,
      satellite: satelliteRows.filter((r) => r.action !== "INIT").length,
    },
  });
}
