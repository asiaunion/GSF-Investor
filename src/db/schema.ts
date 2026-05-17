import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── 관심종목 마스터 ──────────────────────────────────────────────────────────
export const stocks = sqliteTable("stocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  yahooTicker: text("yahoo_ticker"),
  dartCorpCode: text("dart_corp_code"),
  secCik: text("sec_cik"),
  name: text("name").notNull(),
  market: text("market").notNull(), // 'KR' | 'US'
  category: text("category").default("Core"), // 'Core' | 'Satellite'
  sector: text("sector"), // e.g. 'Food & Beverage' | 'Technology' | 'Finance' | 'ETF'
  broker: text("broker"),
  thesis: text("thesis"),
  addedAt: text("added_at").default(sql`(datetime('now'))`),
  isActive: integer("is_active").default(1),
});

// ── 재무제표 시계열 ───────────────────────────────────────────────────────────
export const financials = sqliteTable(
  "financials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stockId: integer("stock_id").references(() => stocks.id),
    period: text("period").notNull(), // '2026Q1', '2025FY'
    revenue: real("revenue"),
    opIncome: real("op_income"),
    netIncome: real("net_income"),
    totalAssets: real("total_assets"),
    totalEquity: real("total_equity"),
    cashAndEquivalents: real("cash_and_equivalents"),
    debtRatio: real("debt_ratio"),
    sharesOutstanding: integer("shares_outstanding"),
    eps: real("eps"),
    bps: real("bps"),
    roe: real("roe"),
    operatingMargin: real("operating_margin"),
    dividendPerShare: real("dividend_per_share"),
    freeCashFlow: real("free_cash_flow"),
    source: text("source"), // 'DART' | 'SEC'
    fetchedAt: text("fetched_at").default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("uq_financials").on(t.stockId, t.period, t.source)]
);

// ── 주가/배당 ────────────────────────────────────────────────────────────────
export const prices = sqliteTable(
  "prices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stockId: integer("stock_id").references(() => stocks.id),
    date: text("date").notNull(),
    closePrice: real("close_price"),
    volume: integer("volume"),
    dividend: real("dividend").default(0),
    currency: text("currency").default("KRW"),
  },
  (t) => [uniqueIndex("uq_prices").on(t.stockId, t.date)]
);

// ── 공시 ─────────────────────────────────────────────────────────────────────
export const disclosures = sqliteTable("disclosures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id),
  source: text("source").notNull(), // 'DART' | 'SEC'
  filedAt: text("filed_at").notNull(),
  title: text("title").notNull(),
  summaryAi: text("summary_ai"),
  rawUrl: text("raw_url"),
  rcpNo: text("rcp_no"),
  fetchedAt: text("fetched_at").default(sql`(datetime('now'))`),
});

// ── 시그널 ───────────────────────────────────────────────────────────────────
export const signals = sqliteTable("signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id),
  detectedAt: text("detected_at").default(sql`(datetime('now'))`),
  type: text("type").notNull(), // 'INSIDER_BUY' | 'STAKE_CHANGE' | ...
  severity: text("severity").default("MEDIUM"), // 'HIGH' | 'MEDIUM' | 'LOW'
  description: text("description").notNull(),
  isResolved: integer("is_resolved").default(0),
  resolvedNote: text("resolved_note"),
});

// ── 매매 일지 ────────────────────────────────────────────────────────────────
export const tradeJournal = sqliteTable("trade_journal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id),
  tradedAt: text("traded_at").notNull(),
  action: text("action").notNull(), // 'BUY' | 'SELL' | 'INIT'
  quantity: integer("quantity").notNull(),
  price: real("price").notNull(),
  currency: text("currency").default("KRW"),
  thesis: text("thesis").notNull(), // 필수: 왜 샀/팔았는가
  category: text("category").default("Core"), // 'Core' | 'Satellite'
  emotionTag: text("emotion_tag"), // '확신' | '불안' | '충동' | '계획적'
  confidenceScore: integer("confidence_score"), // 1~5 (확신도)
  loanInterest: real("loan_interest"), // 융자 이자 비용 (원화, 선택)
  retrospective: text("retrospective"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── AI 분석 보고서 ───────────────────────────────────────────────────────────
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id),
  generatedAt: text("generated_at").default(sql`(datetime('now'))`),
  trigger: text("trigger"), // 'SIGNAL_AUTO' | 'MANUAL'
  contentMd: text("content_md").notNull(),
  chartsJson: text("charts_json"),
});

// ── 주식담보대출 ────────────────────────────────────────────────────────────
export const stockLoans = sqliteTable("stock_loans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id), // 담보 종목 (null=포트폴리오 전체)
  label: text("label").notNull().default("주식담보대출"),
  loanAmount: real("loan_amount").notNull(),   // 대출 원금 (KRW)
  interestRate: real("interest_rate").notNull(), // 연이자율 (%)
  // 파생 계산: annual_interest = loan_amount * interest_rate / 100
  //            monthly_interest = annual_interest / 12
  startedAt: text("started_at"),               // 대출 시작일
  isActive: integer("is_active").default(1),
  note: text("note"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── 종목 메모 (시계열 누적) ──────────────────────────────────────────────────
export const stockNotes = sqliteTable("stock_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockId: integer("stock_id").references(() => stocks.id),
  contentMd: text("content_md").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ── 시그널 커스텀 규칙 (Phase 1: 스키마만, 하드코딩 규칙 사용) ──────────────
export const signalRules = sqliteTable("signal_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  severity: text("severity").default("MEDIUM"),
  conditionJson: text("condition_json").notNull(),
  isActive: integer("is_active").default(1),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ── 환율 ─────────────────────────────────────────────────────────────────────
export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pair: text("pair").notNull().default("USDKRW"),
    date: text("date").notNull(),
    rate: real("rate").notNull(),
    fetchedAt: text("fetched_at").default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("uq_exchange_rates").on(t.pair, t.date)]
);

// ── Type Exports ─────────────────────────────────────────────────────────────
export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;
export type Financial = typeof financials.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Disclosure = typeof disclosures.$inferSelect;
export type Signal = typeof signals.$inferSelect;
export type TradeJournal = typeof tradeJournal.$inferSelect;
export type NewTradeJournal = typeof tradeJournal.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type StockNote = typeof stockNotes.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type StockLoan = typeof stockLoans.$inferSelect;
export type NewStockLoan = typeof stockLoans.$inferInsert;
