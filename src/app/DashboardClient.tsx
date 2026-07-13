"use client";

import type { ReactNode } from "react";
import {
  ReturnBarChart,
  formatKRW,
} from "@/components/DashboardCharts";
import { formatMoney, type BaseCurrency, type FxRates } from "@/lib/format-money";
import NetWorthHistoryChart from "@/components/NetWorthHistoryChart";
import PortfolioPerformanceChart from "@/components/PortfolioPerformanceChart";
import ActivityTimeline, { type ActivityItem } from "@/components/ActivityTimeline";
import Link from "next/link";
import StockIdentity from "@/components/StockIdentity";
import { PnlMethodHint } from "@/components/PnlMethodHint";
import { severityConfig } from "@/lib/economist-ui";

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface Holding {
  stockId: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  sector: string | null;
  broker: string | null;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: string;
  evalAmountKRW: number;
  costAmountKRW: number;
  returnRate: number;
  priceDate: string | null;
}

interface Summary {
  totalEvalKRW: number;
  totalCostKRW: number;
  totalReturnRate: number;
  usdKrw: number;
  fxDate: string | null;
  coreKRW: number;
  satelliteKRW: number;
  benchmarkReturn: number | null;
  alpha: number | null;
}

interface RecentSignal {
  id: number;
  ticker: string;
  stockName: string;
  type: string;
  severity: string;
  description: string;
  detectedAt: string;
  isResolved: number;
}

interface ContribItem {
  ticker: string;
  name: string;
  weightPct: number;
  pnlKRW: number;
  category: string;
  sector: string | null;
}

interface SectorItem {
  sector: string;
  valueKRW: number;
  pct: number;
}

interface LoanItem {
  id: number;
  ticker: string | null;
  label: string;
  loanAmount: number;
  interestRate: number;
  startedAt: string | null;
  isActive: number;
  note: string | null;
  annualInterest: number;
  monthlyInterest: number;
}

interface Props {
  data: { holdings: Holding[]; summary: Summary };
  recentSignals: RecentSignal[];
  contribData: ContribItem[];
  sectorData: SectorItem[];
  loans: LoanItem[];
  activityItems: ActivityItem[];
  baseCurrency: BaseCurrency;
  fxRates: FxRates;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function DashboardClient({
  data,
  recentSignals,
  contribData,
  sectorData,
  loans,
  activityItems,
  baseCurrency,
  fxRates,
}: Props) {
  const { holdings, summary } = data;
  const fmt = (n: number) => formatMoney(n, baseCurrency, fxRates);

  const barData = holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    returnRate: h.returnRate,
  }));

  const isPositive = summary.totalReturnRate >= 0;
  const isAlphaPositive = (summary.alpha ?? 0) >= 0;
  const pnl = summary.totalEvalKRW - summary.totalCostKRW;

  const totalLoan = loans.reduce((s, l) => s + l.loanAmount, 0);
  const totalAnnual = loans.reduce((s, l) => s + l.annualInterest, 0);
  const ltvPct = summary.totalEvalKRW > 0 ? (totalLoan / summary.totalEvalKRW) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* 1. Hero Strip */}
      <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm px-6 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:divide-x divide-border-default">
          <div className="lg:pr-6">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">총 평가</p>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums text-text-primary leading-none">
              {fmt(summary.totalEvalKRW)}
            </p>
            <p className="text-xs text-text-muted mt-1">원가 {fmt(summary.totalCostKRW)}</p>
          </div>
          <div className="lg:px-6">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wide flex items-center gap-1">
              총 수익률 <PnlMethodHint method="weighted_avg" />
            </p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${isPositive ? "text-profit-400" : "text-loss-400"}`}>
              {isPositive ? "+" : ""}{summary.totalReturnRate.toFixed(2)}%
            </p>
          </div>
          <div className="lg:px-6">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">PnL</p>
            <p className={`text-xl font-semibold tabular-nums leading-none ${pnl >= 0 ? "text-profit-400" : "text-loss-400"}`}>
              {pnl >= 0 ? "+" : ""}{fmt(pnl)}
            </p>
          </div>
          <div className="lg:px-6">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">Alpha</p>
            <p className={`text-xl font-bold tabular-nums leading-none ${summary.alpha !== null ? (isAlphaPositive ? "text-profit-400" : "text-warn-400") : "text-text-disabled"}`}>
              {summary.alpha !== null ? `${isAlphaPositive ? "+" : ""}${summary.alpha.toFixed(2)}%` : "—"}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {summary.benchmarkReturn !== null
                ? `벤치 ${summary.benchmarkReturn >= 0 ? "+" : ""}${summary.benchmarkReturn.toFixed(2)}%`
                : "069500"}
            </p>
          </div>
          <div className="lg:px-6">
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">USD/KRW</p>
            <p className="text-base font-semibold text-text-secondary tabular-nums leading-none">
              {summary.usdKrw > 0 ? summary.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : "—"}
            </p>
            <p className="text-xs text-text-muted mt-1">{summary.fxDate ? summary.fxDate.slice(5) : "—"}</p>
          </div>
        </div>
      </div>

      {/* 2. Decision Panel */}
      <DecisionPanel holdings={holdings} />

      {/* 3. NetWorthHistoryChart */}
      <NetWorthHistoryChart baseCurrency={baseCurrency} fxRates={fxRates} />

      {/* 4. PortfolioPerformanceChart */}
      <PortfolioPerformanceChart />

      {/* 5. 보유 종목 테이블 */}
      <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">보유 종목</h2>
          <Link href="/journal" className="text-xs text-brand-green hover:text-brand-green/80">
            매매 일지 →
          </Link>
        </div>
        {holdings.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-text-muted text-xs mb-2">보유 종목 없음</p>
            <Link href="/journal" className="text-[10px] text-brand-green underline">
              INIT 추가
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-bg-elevated/30">
                  <th className="text-left px-3 py-1 font-medium text-text-muted">종목</th>
                  <th className="text-right px-2 py-1 font-medium text-text-muted hidden sm:table-cell">수량</th>
                  <th className="text-right px-2 py-1 font-medium text-text-muted hidden md:table-cell">단가</th>
                  <th className="text-right px-2 py-1 font-medium text-text-muted">현재</th>
                  <th className="text-right px-2 py-1 font-medium text-text-muted">평가</th>
                  <th className="text-right px-2 py-1 font-medium text-text-muted">수익</th>
                  <th className="text-right px-3 py-1 font-medium text-text-muted">수익률</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const pos = h.returnRate >= 0;
                  const pnlKRW = h.evalAmountKRW - h.costAmountKRW;
                  const pnlPos = pnlKRW >= 0;
                  const isUS = h.currency === "USD";
                  const fmtPrice = (p: number) =>
                    isUS ? `$${p.toFixed(2)}` : `${p.toLocaleString("ko-KR")}`;
                  return (
                    <tr
                      key={h.stockId}
                      className={`border-b border-border-default/30 hover:bg-bg-elevated/25 ${i === holdings.length - 1 ? "border-0" : ""}`}
                    >
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-0.5 h-8 shrink-0 rounded-sm ${h.category === "Core" ? "bg-brand-green" : "bg-brand-blue"}`} />
                          <StockIdentity
                            name={h.name}
                            ticker={h.ticker}
                            href={`/stocks/${h.ticker}`}
                            size="sm"
                            trailing={
                              h.sector ? (
                                <span className="text-[10px] text-text-muted">{h.sector}</span>
                              ) : undefined
                            }
                          />
                        </div>
                      </td>
                      <td className="text-right px-2 py-1.5 text-text-secondary tabular-nums hidden sm:table-cell">
                        {h.quantity.toLocaleString()}주
                      </td>
                      <td className="text-right px-2 py-1 text-text-muted tabular-nums hidden md:table-cell">
                        {fmtPrice(h.avgPrice)}
                      </td>
                      <td className="text-right px-2 py-1 text-text-secondary tabular-nums">
                        {fmtPrice(h.currentPrice)}
                      </td>
                      <td className="text-right px-2 py-1.5 text-text-secondary tabular-nums font-medium">
                        {formatKRW(h.evalAmountKRW)}
                      </td>
                      <td className={`text-right px-2 py-1.5 tabular-nums font-medium ${pnlPos ? "text-profit-400" : "text-loss-400"}`}>
                        {pnlPos ? "+" : ""}
                        {formatKRW(pnlKRW)}
                      </td>
                      <td className="text-right px-3 py-1.5 tabular-nums">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-md text-xs font-bold ${
                            pos ? "text-profit-400 bg-profit-bg border border-profit-border" : "text-loss-400 bg-loss-bg border border-loss-border"
                          }`}
                        >
                          {pos ? "+" : ""}
                          {h.returnRate.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. 수익률 막대 + 대출 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm px-4 pt-4 pb-3 min-h-[240px] flex flex-col">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">종목별 수익률</h2>
            <span className="text-xs text-text-muted">매입가 기준</span>
          </div>
          {barData.length > 0 ? (
            <ReturnBarChart data={barData} />
          ) : (
            <EmptyState message="보유 없음" cta={{ label: "일지", href: "/journal" }} />
          )}
        </div>
        <LoanPanel loans={loans} totalLoan={totalLoan} totalAnnual={totalAnnual} ltvPct={ltvPct} />
      </div>

      {/* 7. 시그널 + 타임라인 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityTimeline items={activityItems} />
        
        {/* 시그널 패널 */}
        <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              최근 시그널
              {recentSignals.some((s) => s.isResolved === 0 && s.severity === "HIGH") && (
                <span className="w-2 h-2 rounded-full bg-loss-500 animate-pulse" />
              )}
            </h2>
            <Link href="/signals" className="text-xs text-brand-green">전체 보기 →</Link>
          </div>
          {recentSignals.length === 0 ? (
            <p className="px-4 py-4 text-sm text-text-muted">시그널 없음</p>
          ) : (
            <div className="divide-y divide-border-default/50">
              {recentSignals.map((s) => {
                const sev = severityConfig[s.severity as keyof typeof severityConfig] ?? severityConfig.LOW;
                return (
                  <div
                    key={s.id}
                    className={`px-4 py-2.5 flex gap-2 text-sm ${sev.bg} ${s.isResolved ? "opacity-50" : ""}`}
                  >
                    <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${sev.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`text-xs font-semibold shrink-0 ${sev.text}`}>{s.severity}</span>
                        <StockIdentity
                          name={s.stockName}
                          ticker={s.ticker}
                          href={`/stocks/${s.ticker}`}
                          size="sm"
                          className="flex-1 min-w-[8rem]"
                        />
                        <span className="text-text-muted text-xs shrink-0">{s.detectedAt?.slice(0, 10)}</span>
                      </div>
                      <p className="text-text-secondary text-xs mt-0.5 line-clamp-2">{s.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function DecisionPanel({ holdings }: { holdings: Holding[] }) {
  // 현재는 하드코딩 — 향후 research/DECISIONS.md 또는 DB 연동
  const decisions: Record<string, { action: string; conviction: string; note: string }> = {
    "026960": {
      action: "보유",
      conviction: "Mid",
      note: "기대수익 +29.7% · 8월 반기보고서 대기 · S8 이격 +7%",
    },
  };

  if (holdings.length === 0) return null;

  return (
    <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-green inline-block" />
          오늘의 판단
        </h2>
        <span className="text-xs text-text-muted">리서치 프레임워크 연동</span>
      </div>
      <div className="divide-y divide-border-default/50">
        {holdings.map((h) => {
          const d = decisions[h.ticker] ?? { action: "관찰", conviction: "—", note: "판단 미등록" };
          const actionColor =
            d.action === "매수" ? "text-profit-400 bg-profit-bg border border-profit-border"
            : d.action === "매도" ? "text-loss-400 bg-loss-bg border border-loss-border"
            : "text-brand-green bg-brand-green/8 border border-brand-green/25";
          return (
            <div key={h.stockId} className="px-5 py-3 flex items-center gap-4">
              <div className="shrink-0">
                <p className="text-sm font-semibold text-text-primary">{h.name}</p>
                <p className="text-xs text-text-muted">{h.ticker}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 ${actionColor}`}>
                {d.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-secondary truncate">{d.note}</p>
              </div>
              <span className="text-xs text-text-muted shrink-0">Conviction: {d.conviction}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoanPanel({ loans, totalLoan, totalAnnual, ltvPct }: { loans: LoanItem[], totalLoan: number, totalAnnual: number, ltvPct: number }) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">대출 현황</h2>
        <Link href="/settings" className="text-xs text-brand-green">관리 →</Link>
      </div>
      {loans.length === 0 ? (
        <p className="px-4 py-4 text-sm text-text-muted">등록된 대출 없음</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border-default border-b border-border-default">
            {[
              { label: "대출원금", value: formatKRW(totalLoan), cls: "text-warn-400" },
              { label: "연간 이자", value: formatKRW(Math.round(totalAnnual)), cls: "text-loss-400" },
              { label: "월평균 이자", value: formatKRW(Math.round(totalAnnual / 12)), cls: "text-warn-500" },
              { label: "LTV", value: `${ltvPct.toFixed(1)}%`, cls: ltvPct > 60 ? "text-loss-400" : "text-text-secondary" },
            ].map((item) => (
              <div key={item.label} className="px-3 py-2.5">
                <p className="text-xs text-text-muted mb-0.5">{item.label}</p>
                <p className={`text-sm font-bold tabular-nums ${item.cls}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border-default/50">
            {loans.map((loan) => (
              <div key={loan.id} className="px-4 py-2.5 flex justify-between gap-3 text-sm">
                <span className="text-text-primary truncate">
                  {loan.label}
                  {loan.ticker && <span className="text-text-muted ml-1">{loan.ticker}</span>}
                </span>
                <span className="text-warn-400 tabular-nums shrink-0">{formatKRW(loan.loanAmount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="h-20 flex flex-col items-center justify-center gap-1 text-text-muted text-xs">
      <span>{message}</span>
      {cta && (
        <Link href={cta.href} className="text-brand-green/80 hover:text-brand-green underline">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
