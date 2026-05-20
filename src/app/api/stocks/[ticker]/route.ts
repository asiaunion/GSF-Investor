import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker } = await params;

  // 종목 기본 정보
  const stockRow = await db.run(sql`
    SELECT id, ticker, name, market, category, broker, thesis, dart_corp_code, sec_cik, yahoo_ticker
    FROM stocks
    WHERE ticker = ${ticker} AND is_active = 1
    LIMIT 1
  `);

  if (stockRow.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sr = stockRow.rows[0];
  const stockId = Number(sr[0]);
  const market = String(sr[3]);
  const currency = market === "US" ? "USD" : "KRW";

  // 환율
  const fxRow = await db.run(sql`
    SELECT rate, date FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  const usdkrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;

  // 최신 주가
  const latestPriceRow = await db.run(sql`
    SELECT close_price, date, currency FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 1
  `);

  // 최근 30일 주가 (차트용)
  const priceChartRows = await db.run(sql`
    SELECT date, close_price FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 90
  `);

  // 재무제표 (최근 8분기) — FY 우선, 없으면 분기
  const financialRows = await db.run(sql`
    SELECT
      period, revenue, op_income, net_income,
      total_assets, total_equity, cash_and_equivalents,
      debt_ratio, eps, bps, roe, dividend_per_share, source
    FROM financials
    WHERE stock_id = ${stockId}
    ORDER BY period DESC LIMIT 8
  `);

  // FY EPS (PER 계산 기준): period가 'FY'로 끝나는 최신 레코드
  const fyFinancialRow = await db.run(sql`
    SELECT eps, bps, roe, net_income, total_equity, dividend_per_share
    FROM financials
    WHERE stock_id = ${stockId} AND period LIKE '%FY'
    ORDER BY period DESC LIMIT 1
  `);

  // 공시 (최근 20건)
  const disclosureRows = await db.run(sql`
    SELECT id, source, filed_at, title, summary_ai, raw_url, rcp_no
    FROM disclosures
    WHERE stock_id = ${stockId}
    ORDER BY filed_at DESC LIMIT 20
  `);

  // 시그널 (최근 20건)
  const signalRows = await db.run(sql`
    SELECT id, detected_at, type, severity, description, is_resolved, resolved_note
    FROM signals
    WHERE stock_id = ${stockId}
    ORDER BY detected_at DESC LIMIT 20
  `);

  // 메모 (최근 10건)
  const noteRows = await db.run(sql`
    SELECT id, content_md, created_at, updated_at
    FROM stock_notes
    WHERE stock_id = ${stockId}
    ORDER BY created_at DESC LIMIT 10
  `);

  // v_portfolio 보유 정보
  const portfolioRow = await db.run(sql`
    SELECT vp.quantity, vp.avg_price
    FROM v_portfolio vp
    JOIN stocks s ON s.ticker = vp.ticker
    WHERE s.id = ${stockId}
    LIMIT 1
  `);

  const currentPrice =
    latestPriceRow.rows.length > 0 ? Number(latestPriceRow.rows[0][0]) : null;
  const priceDate =
    latestPriceRow.rows.length > 0 ? String(latestPriceRow.rows[0][1]) : null;
  const priceCurrency =
    latestPriceRow.rows.length > 0 ? String(latestPriceRow.rows[0][2]) : currency;

  const portfolio =
    portfolioRow.rows.length > 0
      ? {
          quantity: Number(portfolioRow.rows[0][0]),
          avgPrice: Number(portfolioRow.rows[0][1]),
        }
      : null;

  // 재무 데이터 파싱 (ROE null시 netIncome/totalEquity 런타임 계산)
  const financials = financialRows.rows
    .map((r) => {
      const netIncome = r[3] != null ? Number(r[3]) : null;
      const totalEquity = r[5] != null ? Number(r[5]) : null;
      const roeStored = r[10] != null ? Number(r[10]) : null;
      // ROE 폴백: DB에 null이면 순이익/자본 * 100으로 계산
      const roeComputed =
        roeStored !== null
          ? roeStored
          : netIncome != null && totalEquity != null && totalEquity > 0
          ? (netIncome / totalEquity) * 100
          : null;
      return {
        period: String(r[0]),
        revenue: r[1] != null ? Number(r[1]) : null,
        opIncome: r[2] != null ? Number(r[2]) : null,
        netIncome,
        totalAssets: r[4] != null ? Number(r[4]) : null,
        totalEquity,
        cashAndEquivalents: r[6] != null ? Number(r[6]) : null,
        debtRatio: r[7] != null ? Number(r[7]) : null,
        eps: r[8] != null ? Number(r[8]) : null,
        bps: r[9] != null ? Number(r[9]) : null,
        roe: roeComputed,
        dividendPerShare: r[11] != null ? Number(r[11]) : null,
        source: String(r[12]),
      };
    })
    .reverse(); // 오래된 것부터 정렬 (차트용)

  // FY 재무 파싱 (PER/PBR/배당률 계산 기준)
  const fyFinancial =
    fyFinancialRow.rows.length > 0
      ? {
          eps: fyFinancialRow.rows[0][0] != null ? Number(fyFinancialRow.rows[0][0]) : null,
          bps: fyFinancialRow.rows[0][1] != null ? Number(fyFinancialRow.rows[0][1]) : null,
          roe: fyFinancialRow.rows[0][2] != null ? Number(fyFinancialRow.rows[0][2]) : null,
          netIncome: fyFinancialRow.rows[0][3] != null ? Number(fyFinancialRow.rows[0][3]) : null,
          totalEquity: fyFinancialRow.rows[0][4] != null ? Number(fyFinancialRow.rows[0][4]) : null,
          dividendPerShare: fyFinancialRow.rows[0][5] != null ? Number(fyFinancialRow.rows[0][5]) : null,
        }
      : null;

  // 최신 재무에서 PBR/배당률 (FY 우선, 없으면 최신 분기)
  const latestFinancial = financials.length > 0 ? financials[financials.length - 1] : null;
  const refFinancial = fyFinancial ?? latestFinancial;

  // PER: 반드시 FY EPS 기준 (분기 EPS × 4 근사는 사용하지 않음)
  const per =
    currentPrice != null && fyFinancial?.eps && fyFinancial.eps > 0
      ? currentPrice / fyFinancial.eps
      : null;
  const pbr =
    currentPrice != null && refFinancial?.bps && refFinancial.bps > 0
      ? currentPrice / refFinancial.bps
      : null;
  const dividendYield =
    currentPrice != null && refFinancial?.dividendPerShare && refFinancial.dividendPerShare > 0
      ? (refFinancial.dividendPerShare / currentPrice) * 100
      : null;

  const overviewRoe =
    fyFinancial?.roe ??
    (fyFinancial?.netIncome != null &&
    fyFinancial?.totalEquity != null &&
    fyFinancial.totalEquity > 0
      ? (fyFinancial.netIncome / fyFinancial.totalEquity) * 100
      : null);

  const holdingReturn =
    currentPrice != null && portfolio?.avgPrice && portfolio.avgPrice > 0
      ? ((currentPrice - portfolio.avgPrice) / portfolio.avgPrice) * 100
      : null;

  return NextResponse.json({
    stock: {
      id: stockId,
      ticker: String(sr[1]),
      name: String(sr[2]),
      market,
      category: String(sr[4]),
      broker: sr[5] ? String(sr[5]) : null,
      thesis: sr[6] ? String(sr[6]) : null,
      dartCorpCode: sr[7] ? String(sr[7]) : null,
      secCik: sr[8] ? String(sr[8]) : null,
      yahooTicker: sr[9] ? String(sr[9]) : null,
    },
    overview: {
      currentPrice,
      priceDate,
      currency: priceCurrency,
      per,
      pbr,
      dividendYield,
      roe: overviewRoe,
      holdingReturn,
      portfolio,
      usdkrw,
      overviewBasis: financials.filter((f) => f.period.endsWith("FY")).pop()?.period ?? null,
      perBasis: "FY" as const,
    },
    priceChart: priceChartRows.rows
      .map((r) => ({ date: String(r[0]), price: Number(r[1]) }))
      .reverse(),
    financials,
    disclosures: disclosureRows.rows.map((r) => ({
      id: Number(r[0]),
      source: String(r[1]),
      filedAt: String(r[2]),
      title: String(r[3]),
      summaryAi: r[4] ? String(r[4]) : null,
      rawUrl: r[5] ? String(r[5]) : null,
      rcpNo: r[6] ? String(r[6]) : null,
    })),
    signals: signalRows.rows.map((r) => ({
      id: Number(r[0]),
      detectedAt: String(r[1]),
      type: String(r[2]),
      severity: String(r[3]),
      description: String(r[4]),
      isResolved: Number(r[5]),
      resolvedNote: r[6] ? String(r[6]) : null,
    })),
    notes: noteRows.rows.map((r) => ({
      id: Number(r[0]),
      contentMd: String(r[1]),
      createdAt: String(r[2]),
      updatedAt: String(r[3]),
    })),
  });
}
