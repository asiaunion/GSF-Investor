/**
 * FIFO 실현 손익 계산 유틸리티
 * - analytics API, 미래 리포트 엔진 등에서 공용으로 사용
 * - 순수 함수 모음 (DB 의존 없음 → Vitest 테스트 용이)
 */

// ── 타입 정의 ─────────────────────────────────────────────────────────────────

export interface TradeRow {
  id: number;
  stockId: number;
  tradedAt: string;
  action: "BUY" | "SELL" | "INIT";
  quantity: number;
  price: number;
  currency?: string | null;
  emotionTag?: string | null;
  loanInterest?: number | null;
}

export interface FifoLot {
  qty: number;
  price: number;
  emotion?: string | null;
}

export interface RealizedTrade {
  id: number;
  stockId: number;
  tradedAt: string;
  quantity: number;
  sellPrice: number;
  avgBuyPrice: number;
  realizedPnl: number;    // 세전, 이자 미차감
  loanInterest: number;
  netPnl: number;         // realizedPnl - loanInterest
  returnPct: number;      // 이자 반영 수익률
  returnPctGross: number; // 이자 미반영 수익률
  currency: string | null;
  emotionTag: string | null;
}

export interface FifoQueues {
  [stockId: number]: FifoLot[];
}

// ── 핵심 함수 ─────────────────────────────────────────────────────────────────

/**
 * 시간순으로 정렬된 거래 행들을 처리하여 FIFO 기반 실현 손익 목록을 반환한다.
 * 입력 rows는 반드시 tradedAt ASC로 정렬되어야 한다.
 */
export function computeFifoRealizedTrades(rows: TradeRow[]): RealizedTrade[] {
  const queues: FifoQueues = {};
  const realized: RealizedTrade[] = [];

  for (const row of rows) {
    const sid = row.stockId;
    if (!queues[sid]) queues[sid] = [];

    if (row.action === "BUY" || row.action === "INIT") {
      queues[sid].push({
        qty: row.quantity,
        price: row.price,
        emotion: row.emotionTag ?? null,
      });
    } else if (row.action === "SELL") {
      let remaining = row.quantity;
      let totalCost = 0;
      let matchedQty = 0;

      while (remaining > 0 && queues[sid].length > 0) {
        const head = queues[sid][0];
        const take = Math.min(head.qty, remaining);
        totalCost += take * head.price;
        matchedQty += take;
        remaining -= take;
        head.qty -= take;
        if (head.qty === 0) queues[sid].shift();
      }

      if (matchedQty > 0) {
        const avgBuyPrice = totalCost / matchedQty;
        const sellRevenue = row.quantity * row.price;
        const buyCost = matchedQty * avgBuyPrice;
        const realizedPnl = sellRevenue - buyCost;
        const interest = row.loanInterest ? Number(row.loanInterest) : 0;
        const netPnl = realizedPnl - interest;
        const returnPct = buyCost > 0 ? (netPnl / buyCost) * 100 : 0;
        const returnPctGross = buyCost > 0 ? (realizedPnl / buyCost) * 100 : 0;

        realized.push({
          id: row.id,
          stockId: sid,
          tradedAt: row.tradedAt,
          quantity: row.quantity,
          sellPrice: row.price,
          avgBuyPrice,
          realizedPnl,
          loanInterest: interest,
          netPnl,
          returnPct,
          returnPctGross,
          currency: row.currency ?? null,
          emotionTag: row.emotionTag ?? null,
        });
      }
    }
  }

  return realized;
}

/**
 * 현재 보유 잔량 계산 (FIFO 큐 잔여분)
 * stockId별 평균단가와 수량을 반환한다.
 */
export function computeCurrentHoldings(rows: TradeRow[]): Map<
  number,
  { qty: number; avgPrice: number }
> {
  const queues: FifoQueues = {};

  for (const row of rows) {
    const sid = row.stockId;
    if (!queues[sid]) queues[sid] = [];

    if (row.action === "BUY" || row.action === "INIT") {
      queues[sid].push({ qty: row.quantity, price: row.price });
    } else if (row.action === "SELL") {
      let remaining = row.quantity;
      while (remaining > 0 && queues[sid].length > 0) {
        const head = queues[sid][0];
        const take = Math.min(head.qty, remaining);
        remaining -= take;
        head.qty -= take;
        if (head.qty === 0) queues[sid].shift();
      }
    }
  }

  const result = new Map<number, { qty: number; avgPrice: number }>();
  for (const [sid, lots] of Object.entries(queues) as [string, FifoLot[]][]) {
    const totalQty = lots.reduce((s: number, l: FifoLot) => s + l.qty, 0);
    if (totalQty <= 0) continue;
    const totalCost = lots.reduce((s: number, l: FifoLot) => s + l.qty * l.price, 0);
    result.set(Number(sid), { qty: totalQty, avgPrice: totalCost / totalQty });
  }
  return result;
}

/**
 * 감정 태그별 통계 집계
 */
export type EmotionStats = Record<
  string,
  {
    tag: string;
    count: number;
    buyCount: number;
    sellCount: number;
    totalRealizedPnl: number;
    avgReturnPct: number | null;
    winCount: number;
    lossCount: number;
  }
>;

export function aggregateEmotionStats(
  rows: TradeRow[],
  realized: RealizedTrade[],
  emotionTags: string[]
): EmotionStats {
  const map: EmotionStats = {};

  for (const tag of emotionTags) {
    map[tag] = {
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
    if (!row.emotionTag || !map[row.emotionTag]) continue;
    const stat = map[row.emotionTag];
    stat.count++;
    if (row.action === "BUY" || row.action === "INIT") stat.buyCount++;
    if (row.action === "SELL") stat.sellCount++;
  }

  const returnsByEmotion: Record<string, number[]> = {};
  for (const trade of realized) {
    if (!trade.emotionTag || !map[trade.emotionTag]) continue;
    if (!returnsByEmotion[trade.emotionTag]) returnsByEmotion[trade.emotionTag] = [];
    returnsByEmotion[trade.emotionTag].push(trade.returnPct);
    map[trade.emotionTag].totalRealizedPnl += trade.realizedPnl;
    if (trade.realizedPnl > 0) map[trade.emotionTag].winCount++;
    else map[trade.emotionTag].lossCount++;
  }

  for (const [tag, returns] of Object.entries(returnsByEmotion)) {
    if (map[tag] && returns.length > 0) {
      map[tag].avgReturnPct = returns.reduce((a, b) => a + b, 0) / returns.length;
    }
  }

  return map;
}
