import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Navbar from "@/components/Navbar";
import StockDetailClient from "./StockDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

async function fetchStockData(ticker: string) {
  // 종목 기본 정보
  const stockRow = await db.run(sql`
    SELECT id, ticker, name, market, category, broker, thesis, dart_corp_code, sec_cik, yahoo_ticker
    FROM stocks
    WHERE ticker = ${ticker} AND is_active = 1
    LIMIT 1
  `);

  if (stockRow.rows.length === 0) return null;

  const sr = stockRow.rows[0];
  const stockId = Number(sr[0]);
  const market = String(sr[3]);
  const currency = market === "US" ? "USD" : "KRW";

  // 환율
  const fxRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  const usdkrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;

  // 최신 주가
  const latestPriceRow = await db.run(sql`
    SELECT close_price, date, currency FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 1
  `);

  // 최근 90일 주가 (차트용)
  const priceChartRows = await db.run(sql`
    SELECT date, close_price FROM prices
    WHERE stock_id = ${stockId}
    ORDER BY date DESC LIMIT 90
  `);

  // 재무제표 (최근 8분기)
  const financialRows = await db.run(sql`
    SELECT
      period, revenue, op_income, net_income,
      total_assets, total_equity, cash_and_equivalents,
      debt_ratio, eps, bps, roe, dividend_per_share, source
    FROM financials
    WHERE stock_id = ${stockId}
    ORDER BY period ASC LIMIT 8
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

  const currentPrice = latestPriceRow.rows.length > 0 ? Number(latestPriceRow.rows[0][0]) : null;
  const priceDate = latestPriceRow.rows.length > 0 ? String(latestPriceRow.rows[0][1]) : null;
  const priceCurrency = latestPriceRow.rows.length > 0 ? String(latestPriceRow.rows[0][2]) : currency;

  const portfolio =
    portfolioRow.rows.length > 0
      ? { quantity: Number(portfolioRow.rows[0][0]), avgPrice: Number(portfolioRow.rows[0][1]) }
      : null;

  const financials = financialRows.rows.map((r) => ({
    period: String(r[0]),
    revenue: r[1] != null ? Number(r[1]) : null,
    opIncome: r[2] != null ? Number(r[2]) : null,
    netIncome: r[3] != null ? Number(r[3]) : null,
    totalAssets: r[4] != null ? Number(r[4]) : null,
    totalEquity: r[5] != null ? Number(r[5]) : null,
    cashAndEquivalents: r[6] != null ? Number(r[6]) : null,
    debtRatio: r[7] != null ? Number(r[7]) : null,
    eps: r[8] != null ? Number(r[8]) : null,
    bps: r[9] != null ? Number(r[9]) : null,
    roe: r[10] != null ? Number(r[10]) : null,
    dividendPerShare: r[11] != null ? Number(r[11]) : null,
    source: String(r[12]),
  }));

  const latestFin = financials.length > 0 ? financials[financials.length - 1] : null;
  const per = currentPrice != null && latestFin?.eps && latestFin.eps > 0 ? currentPrice / latestFin.eps : null;
  const pbr = currentPrice != null && latestFin?.bps && latestFin.bps > 0 ? currentPrice / latestFin.bps : null;
  const dividendYield =
    currentPrice != null && latestFin?.dividendPerShare && latestFin.dividendPerShare > 0
      ? (latestFin.dividendPerShare / currentPrice) * 100
      : null;
  const holdingReturn =
    currentPrice != null && portfolio?.avgPrice && portfolio.avgPrice > 0
      ? ((currentPrice - portfolio.avgPrice) / portfolio.avgPrice) * 100
      : null;

  return {
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
    overview: { currentPrice, priceDate, currency: priceCurrency, per, pbr, dividendYield, holdingReturn, portfolio, usdkrw },
    priceChart: priceChartRows.rows.map((r) => ({ date: String(r[0]), price: Number(r[1]) })).reverse(),
    financials,
    disclosures: disclosureRows.rows.map((r) => ({
      id: Number(r[0]), source: String(r[1]), filedAt: String(r[2]),
      title: String(r[3]), summaryAi: r[4] ? String(r[4]) : null,
      rawUrl: r[5] ? String(r[5]) : null, rcpNo: r[6] ? String(r[6]) : null,
    })),
    signals: signalRows.rows.map((r) => ({
      id: Number(r[0]), detectedAt: String(r[1]), type: String(r[2]),
      severity: String(r[3]), description: String(r[4]),
      isResolved: Number(r[5]), resolvedNote: r[6] ? String(r[6]) : null,
    })),
    notes: noteRows.rows.map((r) => ({
      id: Number(r[0]), contentMd: String(r[1]), createdAt: String(r[2]), updatedAt: String(r[3]),
    })),
  };
}

export default async function StockDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const { ticker } = await params;
  const data = await fetchStockData(ticker);
  if (!data) notFound();

  const { stock, overview, priceChart, financials, disclosures, signals, notes } = data;

  const categoryColor =
    stock.category === "Core"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar email={session.user?.email} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 mb-6">
          <a href="/stocks" className="hover:text-zinc-400 transition-colors">관심종목</a>
          <span>›</span>
          <span className="text-zinc-400">{stock.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{stock.name}</h1>
              <span className={`text-[10px] font-medium px-2 py-1 rounded border ${categoryColor}`}>
                {stock.category}
              </span>
              <span className="text-[10px] font-medium px-2 py-1 rounded border bg-zinc-800 text-zinc-400 border-zinc-700">
                {stock.market === "KR" ? "한국" : "미국"} · {stock.ticker}
              </span>
            </div>
            {stock.broker && <p className="text-zinc-600 text-xs mt-1">{stock.broker}</p>}
          </div>

          {stock.yahooTicker && (
            <a
              href={`https://finance.yahoo.com/quote/${stock.yahooTicker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-xs transition-all"
            >
              Yahoo Finance ↗
            </a>
          )}
        </div>

        <StockDetailClient
          stock={stock}
          overview={overview}
          priceChart={priceChart}
          financials={financials}
          disclosures={disclosures}
          signals={signals}
          notes={notes}
        />
      </main>
    </div>
  );
}
