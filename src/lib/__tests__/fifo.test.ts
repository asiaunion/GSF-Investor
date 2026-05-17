import { describe, it, expect } from "vitest";
import {
  computeFifoRealizedTrades,
  computeCurrentHoldings,
  aggregateEmotionStats,
  type TradeRow,
} from "../fifo";

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function row(overrides: Partial<TradeRow> & Pick<TradeRow, "action" | "quantity" | "price">): TradeRow {
  return {
    id: 1,
    stockId: 1,
    tradedAt: "2025-01-01",
    currency: "KRW",
    emotionTag: null,
    loanInterest: null,
    ...overrides,
  };
}

// ── computeFifoRealizedTrades ─────────────────────────────────────────────────
describe("computeFifoRealizedTrades", () => {
  it("단순 BUY → SELL: 정확한 실현 손익 계산", () => {
    const trades: TradeRow[] = [
      row({ id: 1, action: "BUY", quantity: 100, price: 1000 }),
      row({ id: 2, action: "SELL", quantity: 100, price: 1200 }),
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result).toHaveLength(1);
    expect(result[0].realizedPnl).toBe(20000); // (1200 - 1000) * 100
    expect(result[0].avgBuyPrice).toBe(1000);
    expect(result[0].returnPctGross).toBeCloseTo(20, 5);
  });

  it("손실 거래: 음수 realizedPnl", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 50, price: 2000 }),
      row({ id: 2, action: "SELL", quantity: 50, price: 1500 }),
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result[0].realizedPnl).toBe(-25000); // (1500-2000)*50
    expect(result[0].netPnl).toBe(-25000);
  });

  it("융자 이자 차감: netPnl = realizedPnl - interest", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 100, price: 10000 }),
      row({ id: 2, action: "SELL", quantity: 100, price: 11000, loanInterest: 5000 }),
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result[0].realizedPnl).toBe(100000);
    expect(result[0].loanInterest).toBe(5000);
    expect(result[0].netPnl).toBe(95000);
    expect(result[0].returnPct).toBeCloseTo(9.5, 5);
  });

  it("FIFO 순서: 먼저 산 것부터 매도", () => {
    const trades: TradeRow[] = [
      row({ id: 1, action: "BUY", quantity: 100, price: 1000 }), // lot1: @1000
      row({ id: 2, action: "BUY", quantity: 100, price: 2000 }), // lot2: @2000
      row({ id: 3, action: "SELL", quantity: 100, price: 1500 }), // should match lot1 first
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result).toHaveLength(1);
    expect(result[0].avgBuyPrice).toBe(1000); // lot1 기준
    expect(result[0].realizedPnl).toBe(50000); // (1500-1000)*100
  });

  it("FIFO 부분 매도: 이전 lot에서 일부, 다음 lot에서 나머지", () => {
    const trades: TradeRow[] = [
      row({ id: 1, action: "BUY", quantity: 60, price: 1000 }),
      row({ id: 2, action: "BUY", quantity: 60, price: 2000 }),
      row({ id: 3, action: "SELL", quantity: 100, price: 1500 }),
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result).toHaveLength(1);
    // avgBuyPrice = (60*1000 + 40*2000) / 100 = (60000+80000)/100 = 1400
    expect(result[0].avgBuyPrice).toBe(1400);
    expect(result[0].realizedPnl).toBe(10000); // (1500-1400)*100
  });

  it("INIT은 BUY와 동일하게 처리", () => {
    const trades: TradeRow[] = [
      row({ action: "INIT", quantity: 200, price: 5000 }),
      row({ id: 2, action: "SELL", quantity: 200, price: 5500 }),
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result).toHaveLength(1);
    expect(result[0].realizedPnl).toBe(100000); // (5500-5000)*200
  });

  it("다종목 혼재: 각 stockId별로 독립 FIFO 큐", () => {
    const trades: TradeRow[] = [
      row({ id: 1, stockId: 1, action: "BUY", quantity: 100, price: 1000 }),
      row({ id: 2, stockId: 2, action: "BUY", quantity: 50, price: 3000 }),
      row({ id: 3, stockId: 1, action: "SELL", quantity: 100, price: 1200 }),
      row({ id: 4, stockId: 2, action: "SELL", quantity: 50, price: 2800 }),
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result).toHaveLength(2);
    const r1 = result.find((r) => r.stockId === 1)!;
    const r2 = result.find((r) => r.stockId === 2)!;
    expect(r1.realizedPnl).toBe(20000);  // (1200-1000)*100
    expect(r2.realizedPnl).toBe(-10000); // (2800-3000)*50
  });

  it("SELL이 BUY보다 많으면 matchedQty=0 건 무시", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 10, price: 1000 }),
      row({ id: 2, action: "SELL", quantity: 100, price: 2000 }), // 10주만 매칭
    ];
    const result = computeFifoRealizedTrades(trades);
    expect(result).toHaveLength(1);
    expect(result[0].avgBuyPrice).toBe(1000);
  });
});

// ── computeCurrentHoldings ───────────────────────────────────────────────────
describe("computeCurrentHoldings", () => {
  it("BUY 후 미매도: 전체 잔량 반환", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 100, price: 1000 }),
    ];
    const result = computeCurrentHoldings(trades);
    expect(result.get(1)).toEqual({ qty: 100, avgPrice: 1000 });
  });

  it("BUY → SELL → 잔량 반영", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 100, price: 1000 }),
      row({ id: 2, action: "SELL", quantity: 60, price: 1200 }),
    ];
    const result = computeCurrentHoldings(trades);
    expect(result.get(1)?.qty).toBe(40);
  });

  it("전량 매도 시 map에서 제외", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 100, price: 1000 }),
      row({ id: 2, action: "SELL", quantity: 100, price: 1200 }),
    ];
    const result = computeCurrentHoldings(trades);
    expect(result.has(1)).toBe(false);
  });
});

// ── aggregateEmotionStats ─────────────────────────────────────────────────────
describe("aggregateEmotionStats", () => {
  it("감정 태그 없는 거래는 무시", () => {
    const trades: TradeRow[] = [
      row({ action: "BUY", quantity: 100, price: 1000, emotionTag: null }),
    ];
    const realized = computeFifoRealizedTrades(trades);
    const stats = aggregateEmotionStats(trades, realized, ["확신"]);
    expect(stats["확신"].count).toBe(0);
  });

  it("확신 BUY+SELL 집계", () => {
    const trades: TradeRow[] = [
      row({ id: 1, action: "BUY", quantity: 100, price: 1000, emotionTag: "확신" }),
      row({ id: 2, action: "SELL", quantity: 100, price: 1200, emotionTag: "확신" }),
    ];
    const realized = computeFifoRealizedTrades(trades);
    const stats = aggregateEmotionStats(trades, realized, ["확신"]);
    expect(stats["확신"].count).toBe(2);
    expect(stats["확신"].buyCount).toBe(1);
    expect(stats["확신"].sellCount).toBe(1);
    expect(stats["확신"].totalRealizedPnl).toBe(20000);
    expect(stats["확신"].winCount).toBe(1);
    expect(stats["확신"].lossCount).toBe(0);
    expect(stats["확신"].avgReturnPct).toBeCloseTo(20, 5);
  });
});
