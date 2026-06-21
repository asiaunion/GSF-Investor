import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { toObjs, toObj } from "@/lib/db-utils";
import {
  scoreDebtRatio,
  scoreDividendYears,
  scorePbr,
  scorePer,
  SCREENING_PRESETS,
  type ScreeningPresetId,
} from "@/lib/screening-presets";
import {
  computePerFy,
  computePbrFy,
  findLatestFy,
  type FinancialRow,
} from "@/lib/valuation-metrics";

export const dynamic = "force-dynamic";

const PRESET_IDS = Object.keys(SCREENING_PRESETS) as ScreeningPresetId[];

/**
 * GET /api/discover/all-scores?preset=balanced|value|growth|dividend
 *
 * 모든 관심종목에 대해 체크리스트를 일괄 계산.
 * 배치 쿼리 5개로 전종목 처리 (N+1 제거).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawPreset = req.nextUrl.searchParams.get("preset") ?? "balanced";
  const preset: ScreeningPresetId = PRESET_IDS.includes(rawPreset as ScreeningPresetId)
    ? (rawPreset as ScreeningPresetId)
    : "balanced";

  // ── 배치 쿼리 1: 모든 활성 종목 ────────────────────────────────────────────
  const stockRows = await db.run(sql`
    SELECT id, ticker, name, market, category, yahoo_ticker
    FROM stocks
    WHERE is_active = 1
    ORDER BY category, name
  `);
  const stocks = toObjs(stockRows as unknown as import("@/lib/db-utils").RawResult);
  if (!stocks.length) return NextResponse.json({ preset, presetLabel: SCREENING_PRESETS[preset].label, stocks: [] });

  // ── 배치 쿼리 2: 전종목 재무 (최근 8분기) ───────────────────────────────────
  const finRows = await db.run(sql`
    SELECT stock_id, period, debt_ratio, eps, bps, dividend_per_share
    FROM financials
    WHERE stock_id IN (SELECT id FROM stocks WHERE is_active = 1)
    ORDER BY stock_id, period DESC
  `);
  const finsByStock = new Map<number, FinancialRow[]>();
  const debtByStock = new Map<number, number | null>();
  for (const r of toObjs(finRows as unknown as import("@/lib/db-utils").RawResult)) {
    const sid = Number(r.stock_id);
    if (!finsByStock.has(sid)) {
      finsByStock.set(sid, []);
      debtByStock.set(sid, null);
    }
    const arr = finsByStock.get(sid)!;
    if (arr.length < 8) {
      arr.push({
        period: String(r.period ?? ""),
        eps: r.eps != null ? Number(r.eps) : null,
        bps: r.bps != null ? Number(r.bps) : null,
      });
      // 부채비율: FY 우선, 없으면 최신 분기
      const dr = r.debt_ratio != null ? Number(r.debt_ratio) : null;
      const existing = debtByStock.get(sid);
      if (existing === null || String(r.period ?? "").endsWith("FY")) {
        if (dr !== null) debtByStock.set(sid, dr);
      }
    }
  }

  // ── 배치 쿼리 3: 전종목 최신 주가 ──────────────────────────────────────────
  const priceRows = await db.run(sql`
    SELECT p.stock_id, p.close_price
    FROM prices p
    INNER JOIN (
      SELECT stock_id, MAX(date) AS max_date FROM prices
      WHERE stock_id IN (SELECT id FROM stocks WHERE is_active = 1)
      GROUP BY stock_id
    ) latest ON p.stock_id = latest.stock_id AND p.date = latest.max_date
  `);
  const priceByStock = new Map<number, number>();
  for (const r of toObjs(priceRows as unknown as import("@/lib/db-utils").RawResult)) {
    priceByStock.set(Number(r.stock_id), Number(r.close_price));
  }

  // ── 배치 쿼리 4: 내부자 매수 시그널 (최근 6개월) ───────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsStr = sixMonthsAgo.toISOString().slice(0, 10);
  const insiderRows = await db.run(sql`
    SELECT DISTINCT stock_id FROM signals
    WHERE stock_id IN (SELECT id FROM stocks WHERE is_active = 1)
      AND type IN ('INSIDER_BUY', 'STAKE_CHANGE')
      AND date(detected_at) >= ${sixMonthsStr}
  `);
  const insiderSet = new Set(
    toObjs(insiderRows as unknown as import("@/lib/db-utils").RawResult).map((r) => Number(r.stock_id))
  );

  // ── 배치 쿼리 5: 최근 30일 공시 건수 + 배당 연속성 ─────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [discRows, dividendRows] = await Promise.all([
    db.run(sql`
      SELECT stock_id, COUNT(*) as cnt FROM disclosures
      WHERE stock_id IN (SELECT id FROM stocks WHERE is_active = 1)
        AND filed_at >= ${thirtyDaysStr}
      GROUP BY stock_id
    `),
    db.run(sql`
      SELECT stock_id, COUNT(DISTINCT strftime('%Y', date)) as years
      FROM prices
      WHERE stock_id IN (SELECT id FROM stocks WHERE is_active = 1)
        AND dividend > 0
        AND date >= date('now', '-5 years')
      GROUP BY stock_id
    `),
  ]);

  const discCountByStock = new Map<number, number>();
  for (const r of toObjs(discRows as unknown as import("@/lib/db-utils").RawResult)) {
    discCountByStock.set(Number(r.stock_id), Number(r.cnt ?? 0));
  }
  const dividendYearsByStock = new Map<number, number>();
  for (const r of toObjs(dividendRows as unknown as import("@/lib/db-utils").RawResult)) {
    dividendYearsByStock.set(Number(r.stock_id), Number(r.years ?? 0));
  }

  // ── 지표 계산 ───────────────────────────────────────────────────────────────
  const th = SCREENING_PRESETS[preset].thresholds;
  const results = stocks.map((row) => {
    const stockId = Number(row.id);
    const ticker = String(row.ticker);
    const name = String(row.name);
    const market = String(row.market);
    const category = String(row.category ?? "");

    const fins = finsByStock.get(stockId) ?? [];
    const latestPrice = priceByStock.get(stockId) ?? null;
    const debtRatio = debtByStock.get(stockId) ?? null;
    const discCount = discCountByStock.get(stockId) ?? 0;
    const dividendYearsCount = dividendYearsByStock.get(stockId) ?? 0;
    const hasInsiderBuy = insiderSet.has(stockId);

    const per = computePerFy(latestPrice, fins);
    const pbr = computePbrFy(latestPrice, fins);
    const dividendContinuity = dividendYearsCount >= 4;
    const hasDisclosure = discCount > 0;

    const checks = [
      { label: "PBR", score: scorePbr(pbr, preset), raw: pbr != null ? `${pbr.toFixed(2)}x` : "N/A", pass: pbr != null ? pbr <= th.pbrMax : null },
      { label: "PER", score: scorePer(per, preset), raw: per != null ? `${per.toFixed(1)}x` : "N/A", pass: per != null ? per <= th.perMax : null },
      { label: "부채비율", score: scoreDebtRatio(debtRatio, preset), raw: debtRatio != null ? `${debtRatio.toFixed(1)}%` : "N/A", pass: debtRatio != null ? debtRatio <= th.debtRatioMax : null },
      { label: "배당", score: scoreDividendYears(dividendYearsCount, preset), raw: `${dividendYearsCount}년`, pass: dividendYearsCount >= th.minDividendYears },
      { label: "내부자", score: hasInsiderBuy ? 100 : 0, raw: hasInsiderBuy ? "감지" : "없음", pass: hasInsiderBuy },
      { label: "공시", score: hasDisclosure ? 100 : 0, raw: hasDisclosure ? `${discCount}건` : "없음", pass: hasDisclosure },
    ];

    const totalScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
    const passCount = checks.filter((c) => c.pass === true).length;
    const grade = passCount >= 5 ? "A" : passCount >= 4 ? "B" : passCount >= 3 ? "C" : "D";

    return {
      stockId,
      ticker,
      name,
      market,
      category,
      latestPrice,
      totalScore: Math.round(totalScore),
      grade,
      passCount,
      checks,
      pbr,
      per,
      debtRatio,
    };
  });

  results.sort((a, b) => b.totalScore - a.totalScore);

  return NextResponse.json({
    preset,
    presetLabel: SCREENING_PRESETS[preset].label,
    stocks: results,
  });
}
