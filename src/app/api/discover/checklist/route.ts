import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { toObjs, toObj } from "@/lib/db-utils";
import {
  computePerFy,
  computePbrFy,
  findLatestFy,
  valuationBasisFromFins,
  type FinancialRow,
} from "@/lib/valuation-metrics";

export const dynamic = "force-dynamic";

/**
 * GET /api/discover/checklist?stockId=xxx
 *
 * 6개 체크리스트 자동 실행:
 * 1. PBR < 1.5
 * 2. PER 계산 (업종 평균 대비는 자체 데이터 기준)
 * 3. 부채비율 < 50%
 * 4. 배당 연속성 (5년 연속 — 분기 데이터 20개+)
 * 5. 내부자 거래 (DART/SEC 시그널 최근 6개월)
 * 6. 최근 비경상 공시 유무
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stockId = Number(searchParams.get("stockId"));
  if (!stockId) return NextResponse.json({ error: "stockId required" }, { status: 400 });

  // 종목 정보
  const stockRows = await db.run(sql`
    SELECT ticker, name, market, yahoo_ticker FROM stocks WHERE id = ${stockId}
  `);
  if (!stockRows.rows.length) {
    return NextResponse.json({ error: "종목 없음" }, { status: 404 });
  }
  const stockObj = toObj(stockRows as unknown as import("@/lib/db-utils").RawResult);
  const ticker = String(stockObj.ticker);
  const name = String(stockObj.name);
  const market = String(stockObj.market);

  // 최신 재무 (8분기)
  const finRows = await db.run(sql`
    SELECT period, debt_ratio, eps, bps, dividend_per_share
    FROM financials
    WHERE stock_id = ${stockId}
    ORDER BY period DESC LIMIT 8
  `);
  const fins = toObjs(finRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
    period: String(r.period ?? ""),
    debtRatio: r.debt_ratio != null ? Number(r.debt_ratio) : null,
    eps: r.eps != null ? Number(r.eps) : null,
    bps: r.bps != null ? Number(r.bps) : null,
  }));
  const metricFins: FinancialRow[] = fins.map((f) => ({
    period: f.period,
    eps: f.eps,
    bps: f.bps,
  }));

  // 최신 주가
  const priceRows = await db.run(sql`
    SELECT close_price FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 1
  `);
  const latestPrice = priceRows.rows.length
    ? Number(toObj(priceRows as unknown as import("@/lib/db-utils").RawResult).close_price)
    : null;

  // 최근 6개월 시그널 (내부자 거래)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsStr = sixMonthsAgo.toISOString().slice(0, 10);

  const insiderRows = await db.run(sql`
    SELECT id FROM signals
    WHERE stock_id = ${stockId}
      AND type IN ('INSIDER_BUY', 'STAKE_CHANGE')
      AND date(detected_at) >= ${sixMonthsStr}
    LIMIT 1
  `);

  // 최근 공시 30일
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const discRows = await db.run(sql`
    SELECT title, filed_at FROM disclosures
    WHERE stock_id = ${stockId} AND filed_at >= ${thirtyDaysStr}
    ORDER BY filed_at DESC LIMIT 5
  `);
  const recentDisclosures = toObjs(discRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
    title: String(r.title),
    filedAt: String(r.filed_at),
  }));

  // 배당 연속성 — 과거 5년 동안 배당이 지급된 연도의 수
  const dividendRows = await db.run(sql`
    SELECT strftime('%Y', date) as year, sum(dividend) as total_div
    FROM prices
    WHERE stock_id = ${stockId} AND dividend > 0
    GROUP BY year
    ORDER BY year DESC
    LIMIT 5
  `);
  const dividendYearsCount = dividendRows.rows.length;

  // ── 체크리스트 계산 (FY PER/PBR — 종목 상세와 동일, TTM 미사용) ─────────────
  const per = computePerFy(latestPrice, metricFins);
  const pbr = computePbrFy(latestPrice, metricFins);
  const fyFin = findLatestFy(fins);
  const debtRatio = fyFin?.debtRatio ?? fins[0]?.debtRatio ?? null;
  const valuationBasis = valuationBasisFromFins(metricFins);

  // 5년 연속 배당: 과거 5년 중 배당 지급 연도가 4년 이상이면 통과
  const dividendContinuity = dividendYearsCount >= 4;

  const hasInsiderBuy = insiderRows.rows.length > 0;
  const hasRecentDisclosure = recentDisclosures.length > 0;

  const checklist = [
    {
      no: 1,
      name: "PBR < 1.5",
      pass: pbr != null ? pbr < 1.5 : null,
      value: pbr != null ? `PBR ${pbr.toFixed(2)}x` : "데이터 없음",
      threshold: "< 1.5",
    },
    {
      no: 2,
      name: "PER (적정 수준)",
      pass: per != null ? per < 20 : null,
      value: per != null ? `PER ${per.toFixed(1)}x` : "데이터 없음",
      threshold: "< 20x (참고용)",
    },
    {
      no: 3,
      name: "부채비율 < 50%",
      pass: debtRatio != null ? debtRatio < 50 : null,
      value: debtRatio != null ? `${debtRatio.toFixed(1)}%` : "데이터 없음",
      threshold: "< 50%",
    },
    {
      no: 4,
      name: "배당 연속성",
      pass: dividendContinuity,
      value: `${dividendYearsCount}년 배당 기록`,
      threshold: "최근 5년 중 4년 이상 배당",
    },
    {
      no: 5,
      name: "내부자 매수 (최근 6개월)",
      pass: hasInsiderBuy,
      value: hasInsiderBuy ? "내부자 매수 시그널 감지됨" : "내부자 매수 없음",
      threshold: "DART/SEC 시그널 존재",
    },
    {
      no: 6,
      name: "최근 공시 이벤트",
      pass: hasRecentDisclosure,
      value:
        recentDisclosures.length > 0
          ? `최근 30일 ${recentDisclosures.length}건`
          : "공시 없음",
      threshold: "최근 30일 공시 존재",
    },
  ];

  const passCount = checklist.filter((c) => c.pass === true).length;
  const totalChecks = checklist.filter((c) => c.pass !== null).length;

  return NextResponse.json({
    stockId,
    ticker,
    name,
    market,
    latestPrice,
    valuationBasis,
    checklist,
    summary: {
      passCount,
      totalChecks,
      grade:
        passCount >= 5 ? "A" : passCount >= 4 ? "B" : passCount >= 3 ? "C" : "D",
    },
    recentDisclosures,
  });
}
