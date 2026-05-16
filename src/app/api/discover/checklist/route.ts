import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

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
  const stockRow = stockRows.rows[0];
  const ticker = String(stockRow[0]);
  const name = String(stockRow[1]);
  const market = String(stockRow[2]);

  // 최신 재무 (2분기)
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

  // 최신 주가
  const priceRows = await db.run(sql`
    SELECT close_price FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 1
  `);
  const latestPrice = priceRows.rows.length ? Number(priceRows.rows[0][0]) : null;

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
  const recentDisclosures = discRows.rows.map((r) => ({
    title: String(r[0]),
    filedAt: String(r[1]),
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

  // ── 체크리스트 계산 ─────────────────────────────────────────────────────────
  const latestFin = fins[0] ?? null;

  // PBR = 현재가 / BPS
  let pbr: number | null = null;
  if (latestPrice && latestFin?.bps && latestFin.bps > 0) {
    pbr = latestPrice / latestFin.bps;
  }

  // PER = 현재가 / 연간EPS
  // 1) FY(사업보고서) EPS 우선 사용
  // 2) FY 없으면 최근 4분기 EPS 합산(TTM)
  let per: number | null = null;
  const fyFin = fins.find((f) => f.period.endsWith("FY"));
  const fyEps = fyFin?.eps ?? null;

  if (latestPrice && fyEps && fyEps > 0) {
    per = latestPrice / fyEps;
  } else if (latestPrice) {
    // TTM: 최근 분기 EPS 합산 (Q 포함 최대 4개)
    const qEps = fins
      .filter((f) => f.period.match(/Q\d$/) && f.eps != null && (f.eps as number) > 0)
      .slice(0, 4)
      .map((f) => f.eps as number);
    if (qEps.length === 4) {
      const ttmEps = qEps.reduce((a, b) => a + b, 0);
      if (ttmEps > 0) per = latestPrice / ttmEps;
    }
  }

  const debtRatio = latestFin?.debtRatio ?? null;

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
