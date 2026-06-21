import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  fetchFyGrowthByStockId,
  fetchPriceMetricsByStockId,
} from "@/lib/screener-metrics";
import { toObjs, toObj } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/discover/screen
 * 
 * 쿼리 파라미터:
 * - market: 'KR' | 'US' | 'ALL' (기본값 ALL)
 * - held: 'only' | 'exclude' | 'all' (기본값 all)
 * - perMin, perMax
 * - pbrMin, pbrMax
 * - roeMin, roeMax (단위: %)
 * - return1mMin, pct52wMin (단위: %, Week 2)
 * - revenueYoYMin, epsYoYMin (단위: %, FY 2기 필요)
 */
export async function GET(req: NextRequest) {
  let session = await auth();
  if (process.env.DEV_PREVIEW_AUTH === "true") {
    session = session || {
      user: { email: "preview@gsf-investor.local", name: "Design Preview" },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const market = searchParams.get("market") ?? "ALL";
  const held = searchParams.get("held") ?? "all";

  const perMin = searchParams.get("perMin") ? parseFloat(searchParams.get("perMin")!) : null;
  const perMax = searchParams.get("perMax") ? parseFloat(searchParams.get("perMax")!) : null;
  const pbrMin = searchParams.get("pbrMin") ? parseFloat(searchParams.get("pbrMin")!) : null;
  const pbrMax = searchParams.get("pbrMax") ? parseFloat(searchParams.get("pbrMax")!) : null;
  const roeMin = searchParams.get("roeMin") ? parseFloat(searchParams.get("roeMin")!) : null;
  const roeMax = searchParams.get("roeMax") ? parseFloat(searchParams.get("roeMax")!) : null;
  const return1mMin = searchParams.get("return1mMin")
    ? parseFloat(searchParams.get("return1mMin")!)
    : null;
  const pct52wMin = searchParams.get("pct52wMin")
    ? parseFloat(searchParams.get("pct52wMin")!)
    : null;
  const revenueYoYMin = searchParams.get("revenueYoYMin")
    ? parseFloat(searchParams.get("revenueYoYMin")!)
    : null;
  const epsYoYMin = searchParams.get("epsYoYMin")
    ? parseFloat(searchParams.get("epsYoYMin")!)
    : null;

  try {
    // 1. v_portfolio에서 보유중인 stock_id 조회 (stock_id 직접 사용)
    const portfolioRes = await db.run(sql`
      SELECT stock_id FROM v_portfolio
    `);
    const heldStockIds = new Set<number>(
      toObjs(portfolioRes as unknown as import("@/lib/db-utils").RawResult).map((r) => Number(r.stock_id))
    );

    // 2. 기본 stocks 조회 (is_active = 1)
    let querySql = sql`
      SELECT id, ticker, name, market, category, sector
      FROM stocks
      WHERE is_active = 1
    `;

    if (market === "KR" || market === "US") {
      querySql = sql`
        SELECT id, ticker, name, market, category, sector
        FROM stocks
        WHERE is_active = 1 AND market = ${market}
      `;
    }

    const stockRes = await db.run(querySql);
    const stockObjs = toObjs(stockRes as unknown as import("@/lib/db-utils").RawResult);
    const stockIds = stockObjs.map((r) => Number(r.id));
    const [priceMetricsMap, fyGrowthMap] = await Promise.all([
      fetchPriceMetricsByStockId(stockIds),
      fetchFyGrowthByStockId(stockIds),
    ]);

    const results = [];

    for (const row of stockObjs) {
      const stockId = Number(row.id);
      const ticker = String(row.ticker);
      const name = String(row.name);
      const stockMarket = String(row.market);
      const category = String(row.category ?? "");
      const sector = String(row.sector ?? "");

      // held 필터링
      const isHeld = heldStockIds.has(stockId);
      if (held === "only" && !isHeld) continue;
      if (held === "exclude" && isHeld) continue;

      // 최신 주가 조회
      const priceRes = await db.run(sql`
        SELECT close_price FROM prices
        WHERE stock_id = ${stockId}
        ORDER BY date DESC LIMIT 1
      `);
      const latestPrice = priceRes.rows.length
        ? Number(toObj(priceRes as unknown as import("@/lib/db-utils").RawResult).close_price)
        : null;

      // 최신 FY 재무 데이터 조회 ( period LIKE '%FY' )
      const finRes = await db.run(sql`
        SELECT eps, bps, roe, operating_margin, dividend_per_share, period
        FROM financials
        WHERE stock_id = ${stockId} AND period LIKE '%FY'
        ORDER BY period DESC LIMIT 1
      `);

      let eps: number | null = null;
      let bps: number | null = null;
      let roe: number | null = null;
      let operatingMargin: number | null = null;
      let dividendPerShare: number | null = null;
      let finPeriod: string | null = null;

      if (finRes.rows.length) {
        const fr = toObj(finRes as unknown as import("@/lib/db-utils").RawResult);
        eps = fr.eps != null ? Number(fr.eps) : null;
        bps = fr.bps != null ? Number(fr.bps) : null;
        roe = fr.roe != null ? Number(fr.roe) : null;
        operatingMargin = fr.operating_margin != null ? Number(fr.operating_margin) : null;
        dividendPerShare = fr.dividend_per_share != null ? Number(fr.dividend_per_share) : null;
        finPeriod = fr.period != null ? String(fr.period) : null;
      }

      // 지표 계산
      const per = latestPrice && eps && eps > 0 ? latestPrice / eps : null;
      const pbr = latestPrice && bps && bps > 0 ? latestPrice / bps : null;
      const dividendYield = latestPrice && dividendPerShare != null && latestPrice > 0
        ? (dividendPerShare / latestPrice) * 100
        : null;

      // 범위 필터링 적용
      if (perMin != null && (per == null || per < perMin)) continue;
      if (perMax != null && (per == null || per > perMax)) continue;
      if (pbrMin != null && (pbr == null || pbr < pbrMin)) continue;
      if (pbrMax != null && (pbr == null || pbr > pbrMax)) continue;
      if (roeMin != null && (roe == null || roe < roeMin)) continue;
      if (roeMax != null && (roe == null || roe > roeMax)) continue;

      const priceMetrics = priceMetricsMap.get(stockId);
      const fyGrowth = fyGrowthMap.get(stockId);
      if (
        return1mMin != null &&
        (priceMetrics?.return1m == null || priceMetrics.return1m < return1mMin)
      ) {
        continue;
      }
      if (
        pct52wMin != null &&
        (priceMetrics?.pctFrom52wHigh == null || priceMetrics.pctFrom52wHigh < pct52wMin)
      ) {
        continue;
      }
      if (
        revenueYoYMin != null &&
        (fyGrowth?.revenueYoY == null || fyGrowth.revenueYoY < revenueYoYMin)
      ) {
        continue;
      }
      if (epsYoYMin != null && (fyGrowth?.epsYoY == null || fyGrowth.epsYoY < epsYoYMin)) {
        continue;
      }

      results.push({
        stockId,
        ticker,
        name,
        market: stockMarket,
        category,
        sector,
        latestPrice,
        per: per != null ? Math.round(per * 100) / 100 : null,
        pbr: pbr != null ? Math.round(pbr * 100) / 100 : null,
        roe: roe != null ? Math.round(roe * 100) / 100 : null,
        operatingMargin: operatingMargin != null ? Math.round(operatingMargin * 100) / 100 : null,
        dividendYield: dividendYield != null ? Math.round(dividendYield * 100) / 100 : null,
        isHeld,
        finPeriod,
        return1m: priceMetrics?.return1m ?? null,
        return3m: priceMetrics?.return3m ?? null,
        return6m: priceMetrics?.return6m ?? null,
        return1y: priceMetrics?.return1y ?? null,
        pctFrom52wHigh: priceMetrics?.pctFrom52wHigh ?? null,
        revenueYoY: fyGrowth?.revenueYoY ?? null,
        epsYoY: fyGrowth?.epsYoY ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      stocks: results,
    });
  } catch (error: unknown) {
    console.error("Screen API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
