import { db } from "@/db";
import { financials, prices } from "@/db/schema";
import { and, gte, inArray, like, sql } from "drizzle-orm";

export type PriceReturnMetrics = {
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return1y: number | null;
  pctFrom52wHigh: number | null;
};

export type FyGrowthMetrics = {
  revenueYoY: number | null;
  epsYoY: number | null;
};

const DAY_OFFSETS = [
  ["return1m", 30],
  ["return3m", 90],
  ["return6m", 180],
  ["return1y", 365],
] as const;

function pctChange(latest: number, past: number): number | null {
  if (!Number.isFinite(latest) || !Number.isFinite(past) || past <= 0) return null;
  return Math.round(((latest - past) / past) * 10000) / 100;
}

function computeFromSeries(
  rows: { date: string; close: number }[]
): PriceReturnMetrics {
  if (rows.length === 0) {
    return {
      return1m: null,
      return3m: null,
      return6m: null,
      return1y: null,
      pctFrom52wHigh: null,
    };
  }
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const latestPrice = latest.close;

  const findOnOrBefore = (cutoff: string): number | null => {
    let best: { date: string; close: number } | null = null;
    for (const r of sorted) {
      if (r.date <= cutoff) best = r;
      else break;
    }
    return best?.close ?? null;
  };

  const latestDate = new Date(latest.date + "T12:00:00");
  const metrics: PriceReturnMetrics = {
    return1m: null,
    return3m: null,
    return6m: null,
    return1y: null,
    pctFrom52wHigh: null,
  };

  for (const [key, days] of DAY_OFFSETS) {
    const d = new Date(latestDate);
    d.setDate(d.getDate() - days);
    const cutoff = d.toISOString().slice(0, 10);
    const past = findOnOrBefore(cutoff);
    metrics[key] = past != null ? pctChange(latestPrice, past) : null;
  }

  const window = sorted.slice(-252);
  const high52 = Math.max(...window.map((r) => r.close));
  if (high52 > 0) {
    metrics.pctFrom52wHigh = Math.round(((latestPrice - high52) / high52) * 10000) / 100;
  }

  return metrics;
}

function yoyPct(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 10000) / 100;
}

const cutoff400 = sql`date('now', '-400 days')`;

/** 활성 종목별 가격 수익률·52주 고점 대비 */
export async function fetchPriceMetricsByStockId(
  stockIds: number[]
): Promise<Map<number, PriceReturnMetrics>> {
  const out = new Map<number, PriceReturnMetrics>();
  const ids = stockIds.filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return out;

  const rows = await db
    .select({
      stockId: prices.stockId,
      date: prices.date,
      close: prices.closePrice,
    })
    .from(prices)
    .where(and(inArray(prices.stockId, ids), gte(prices.date, cutoff400)))
    .orderBy(prices.stockId, prices.date);

  const byStock = new Map<number, { date: string; close: number }[]>();
  for (const r of rows) {
    if (r.stockId == null || r.close == null || !r.date) continue;
    const sid = r.stockId;
    if (!byStock.has(sid)) byStock.set(sid, []);
    byStock.get(sid)!.push({ date: r.date, close: r.close });
  }

  for (const sid of ids) {
    out.set(sid, computeFromSeries(byStock.get(sid) ?? []));
  }
  return out;
}

/** FY 2기 기준 매출·EPS YoY */
export async function fetchFyGrowthByStockId(
  stockIds: number[]
): Promise<Map<number, FyGrowthMetrics>> {
  const out = new Map<number, FyGrowthMetrics>();
  const ids = stockIds.filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return out;

  const rows = await db
    .select({
      stockId: financials.stockId,
      period: financials.period,
      revenue: financials.revenue,
      eps: financials.eps,
    })
    .from(financials)
    .where(and(inArray(financials.stockId, ids), like(financials.period, "%FY")))
    .orderBy(financials.stockId, sql`${financials.period} DESC`);

  const byStock = new Map<number, { revenue: number | null; eps: number | null }[]>();
  for (const r of rows) {
    if (r.stockId == null) continue;
    if (!byStock.has(r.stockId)) byStock.set(r.stockId, []);
    const list = byStock.get(r.stockId)!;
    if (list.length >= 2) continue;
    list.push({
      revenue: r.revenue ?? null,
      eps: r.eps ?? null,
    });
  }

  for (const sid of ids) {
    const fy = byStock.get(sid) ?? [];
    out.set(sid, {
      revenueYoY: yoyPct(fy[0]?.revenue ?? null, fy[1]?.revenue ?? null),
      epsYoY: yoyPct(fy[0]?.eps ?? null, fy[1]?.eps ?? null),
    });
  }
  return out;
}
