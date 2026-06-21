import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { toObjs, toObj } from "@/lib/db-utils";

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

  const sr = toObj(stockRow as unknown as import("@/lib/db-utils").RawResult);
  const stockId = Number(sr.id);
  const market = String(sr.market);
  const currency = market === "US" ? "USD" : "KRW";

  // 환율
  const fxRow = await db.run(sql`
    SELECT rate, date FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  if (!fxRow.rows.length) {
    return NextResponse.json({ error: "환율 데이터 없음 — daily_price.py를 먼저 실행하세요" }, { status: 500 });
  }
  const fxObj = toObj(fxRow as unknown as import("@/lib/db-utils").RawResult);
  const usdkrw = Number(fxObj.rate);

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

  // v_portfolio 보유 정보 (stock_id 직접 사용)
  const portfolioRow = await db.run(sql`
    SELECT quantity, avg_price FROM v_portfolio WHERE stock_id = ${stockId} LIMIT 1
  `);

  const latestPriceObj = latestPriceRow.rows.length > 0
    ? toObj(latestPriceRow as unknown as import("@/lib/db-utils").RawResult)
    : null;
  const currentPrice = latestPriceObj ? Number(latestPriceObj.close_price) : null;
  const priceDate = latestPriceObj ? String(latestPriceObj.date) : null;
  const priceCurrency = latestPriceObj ? String(latestPriceObj.currency) : currency;

  const portfolioObj = portfolioRow.rows.length > 0
    ? toObj(portfolioRow as unknown as import("@/lib/db-utils").RawResult)
    : null;
  const portfolio = portfolioObj
    ? { quantity: Number(portfolioObj.quantity), avgPrice: Number(portfolioObj.avg_price) }
    : null;

  // 재무 데이터 파싱 (ROE null시 netIncome/totalEquity 런타임 계산)
  const financials = toObjs(financialRows as unknown as import("@/lib/db-utils").RawResult)
    .map((r) => {
      const netIncome = r.net_income != null ? Number(r.net_income) : null;
      const totalEquity = r.total_equity != null ? Number(r.total_equity) : null;
      const roeStored = r.roe != null ? Number(r.roe) : null;
      const roeComputed =
        roeStored !== null
          ? roeStored
          : netIncome != null && totalEquity != null && totalEquity > 0
          ? (netIncome / totalEquity) * 100
          : null;
      return {
        period: String(r.period),
        revenue: r.revenue != null ? Number(r.revenue) : null,
        opIncome: r.op_income != null ? Number(r.op_income) : null,
        netIncome,
        totalAssets: r.total_assets != null ? Number(r.total_assets) : null,
        totalEquity,
        cashAndEquivalents: r.cash_and_equivalents != null ? Number(r.cash_and_equivalents) : null,
        debtRatio: r.debt_ratio != null ? Number(r.debt_ratio) : null,
        eps: r.eps != null ? Number(r.eps) : null,
        bps: r.bps != null ? Number(r.bps) : null,
        roe: roeComputed,
        dividendPerShare: r.dividend_per_share != null ? Number(r.dividend_per_share) : null,
        source: String(r.source),
      };
    })
    .reverse(); // 오래된 것부터 정렬 (차트용)

  // FY 재무 파싱 (PER/PBR/배당률 계산 기준)
  const fyObj = fyFinancialRow.rows.length > 0
    ? toObj(fyFinancialRow as unknown as import("@/lib/db-utils").RawResult)
    : null;
  const fyFinancial = fyObj
    ? {
        eps: fyObj.eps != null ? Number(fyObj.eps) : null,
        bps: fyObj.bps != null ? Number(fyObj.bps) : null,
        roe: fyObj.roe != null ? Number(fyObj.roe) : null,
        netIncome: fyObj.net_income != null ? Number(fyObj.net_income) : null,
        totalEquity: fyObj.total_equity != null ? Number(fyObj.total_equity) : null,
        dividendPerShare: fyObj.dividend_per_share != null ? Number(fyObj.dividend_per_share) : null,
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
      ticker: String(sr.ticker),
      name: String(sr.name),
      market,
      category: String(sr.category),
      broker: sr.broker ? String(sr.broker) : null,
      thesis: sr.thesis ? String(sr.thesis) : null,
      dartCorpCode: sr.dart_corp_code ? String(sr.dart_corp_code) : null,
      secCik: sr.sec_cik ? String(sr.sec_cik) : null,
      yahooTicker: sr.yahoo_ticker ? String(sr.yahoo_ticker) : null,
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
    priceChart: toObjs(priceChartRows as unknown as import("@/lib/db-utils").RawResult)
      .map((r) => ({ date: String(r.date), price: Number(r.close_price) }))
      .reverse(),
    financials,
    disclosures: toObjs(disclosureRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      id: Number(r.id),
      source: String(r.source),
      filedAt: String(r.filed_at),
      title: String(r.title),
      summaryAi: r.summary_ai ? String(r.summary_ai) : null,
      rawUrl: r.raw_url ? String(r.raw_url) : null,
      rcpNo: r.rcp_no ? String(r.rcp_no) : null,
    })),
    signals: toObjs(signalRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      id: Number(r.id),
      detectedAt: String(r.detected_at),
      type: String(r.type),
      severity: String(r.severity),
      description: String(r.description),
      isResolved: Number(r.is_resolved),
      resolvedNote: r.resolved_note ? String(r.resolved_note) : null,
    })),
    notes: toObjs(noteRows as unknown as import("@/lib/db-utils").RawResult).map((r) => ({
      id: Number(r.id),
      contentMd: String(r.content_md),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })),
  });
}
