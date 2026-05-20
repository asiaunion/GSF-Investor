import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
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
 * 각 종목의 6개 지표 점수와 레이더 차트용 데이터를 반환.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawPreset = req.nextUrl.searchParams.get("preset") ?? "balanced";
  const preset: ScreeningPresetId = PRESET_IDS.includes(rawPreset as ScreeningPresetId)
    ? (rawPreset as ScreeningPresetId)
    : "balanced";

  // 1. 모든 활성 종목
  const stockRows = await db.run(sql`
    SELECT id, ticker, name, market, category, yahoo_ticker
    FROM stocks
    WHERE is_active = 1
    ORDER BY category, name
  `);

  const results = [];

  for (const row of stockRows.rows) {
    const stockId = Number(row[0]);
    const ticker = String(row[1]);
    const name = String(row[2]);
    const market = String(row[3]);
    const category = String(row[4] ?? "");

    // 재무 데이터
    const finRows = await db.run(sql`
      SELECT period, debt_ratio, eps, bps, dividend_per_share
      FROM financials
      WHERE stock_id = ${stockId}
      ORDER BY period DESC LIMIT 8
    `);
    const fins = finRows.rows.map((r) => ({
      period: String(r[0] ?? ""),
      debtRatio: r[1] != null ? Number(r[1]) : null,
      eps: r[2] != null ? Number(r[2]) : null,
      bps: r[3] != null ? Number(r[3]) : null,
    }));
    const metricFins: FinancialRow[] = fins.map((f) => ({
      period: f.period,
      eps: f.eps,
      bps: f.bps,
    }));

    // 최신 주가
    const priceRow = await db.run(sql`
      SELECT close_price FROM prices
      WHERE stock_id = ${stockId}
      ORDER BY date DESC LIMIT 1
    `);
    const latestPrice = priceRow.rows.length ? Number(priceRow.rows[0][0]) : null;

    // 내부자 매수 (최근 6개월)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsStr = sixMonthsAgo.toISOString().slice(0, 10);
    const insiderRow = await db.run(sql`
      SELECT id FROM signals
      WHERE stock_id = ${stockId}
        AND type IN ('INSIDER_BUY', 'STAKE_CHANGE')
        AND date(detected_at) >= ${sixMonthsStr}
      LIMIT 1
    `);

    // 최근 30일 공시
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10);
    const discRow = await db.run(sql`
      SELECT COUNT(*) as cnt FROM disclosures
      WHERE stock_id = ${stockId} AND filed_at >= ${thirtyDaysStr}
    `);
    const discCount = Number(discRow.rows[0]?.[0] ?? 0);

    // 배당 연속성
    const dividendRow = await db.run(sql`
      SELECT strftime('%Y', date) as year, sum(dividend) as total_div
      FROM prices
      WHERE stock_id = ${stockId} AND dividend > 0
      GROUP BY year ORDER BY year DESC LIMIT 5
    `);
    const dividendYearsCount = dividendRow.rows.length;

    // ── 지표 계산 (FY PER/PBR — 종목 상세와 동일) ───────────────────────────
    const per = computePerFy(latestPrice, metricFins);
    const pbr = computePbrFy(latestPrice, metricFins);
    const fyFin = findLatestFy(fins);
    const debtRatio = fyFin?.debtRatio ?? fins[0]?.debtRatio ?? null;
    const hasInsiderBuy = insiderRow.rows.length > 0;
    const dividendContinuity = dividendYearsCount >= 4;
    const hasDisclosure = discCount > 0;

    // ── 체크리스트 → 스코어 ────────────────────────────────────────────────
    // 6개 항목, 각 1점. radar용으로 0~100 스케일 변환
    const th = SCREENING_PRESETS[preset].thresholds;
    const checks = [
      { label: "PBR", score: scorePbr(pbr, preset), raw: pbr != null ? `${pbr.toFixed(2)}x` : "N/A", pass: pbr != null ? pbr <= th.pbrMax : null },
      { label: "PER", score: scorePer(per, preset), raw: per != null ? `${per.toFixed(1)}x` : "N/A", pass: per != null ? per <= th.perMax : null },
      { label: "부채비율", score: scoreDebtRatio(debtRatio, preset), raw: debtRatio != null ? `${debtRatio.toFixed(1)}%` : "N/A", pass: debtRatio != null ? debtRatio <= th.debtRatioMax : null },
      { label: "배당", score: scoreDividendYears(dividendYearsCount, preset), raw: `${dividendYearsCount}년`, pass: dividendYearsCount >= th.minDividendYears },
      { label: "내부자", score: hasInsiderBuy ? 100 : 0, raw: hasInsiderBuy ? "감지" : "없음", pass: hasInsiderBuy },
      { label: "공시", score: hasDisclosure ? 100 : 0, raw: hasDisclosure ? `${discCount}건` : "없음", pass: hasDisclosure },
    ];

    const totalScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length; // 0~100
    const passCount = checks.filter((c) => c.pass === true).length;
    const grade = passCount >= 5 ? "A" : passCount >= 4 ? "B" : passCount >= 3 ? "C" : "D";

    results.push({
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
    });
  }

  // 스코어 내림차순 정렬
  results.sort((a, b) => b.totalScore - a.totalScore);

  return NextResponse.json({
    preset,
    presetLabel: SCREENING_PRESETS[preset].label,
    stocks: results,
  });
}
