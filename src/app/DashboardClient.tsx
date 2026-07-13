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

interface ThesisData {
  action: string;
  conviction: string | null;
  fairValueLocal: number | null;
  expectedReturnPct: number | null;
  nextCatalyst: string | null;
}

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
  weightPct?: number;
  thesis: ThesisData | null;
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

  const weightMap = new Map(contribData.map((c) => [c.ticker, c.weightPct]));
  const holdingsSorted = [...holdings]
    .map((h) => ({ ...h, weightPct: weightMap.get(h.ticker) ?? 0 }))
    .sort((a, b) => b.evalAmountKRW - a.evalAmountKRW);

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
      {/* 1. 2단 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
        {/* 왼쪽: 차트 2개 세로 */}
        <div className="space-y-4">
          <PortfolioPerformanceChart />
          <NetWorthHistoryChart baseCurrency={baseCurrency} fxRates={fxRates} />
        </div>
        {/* 오른쪽: 요약 패널 */}
        <SummaryPanel summary={summary} baseCurrency={baseCurrency} fxRates={fxRates} />
      </div>

      {/* 2. 수평 메트릭 스트립 */}
      <MetricsStrip summary={summary} />

      {/* 3. 판단 패널 */}
      <DecisionPanel holdings={holdingsSorted} />

      {/* 4. 보유 종목 테이블 */}
      <div className="bg-bg-surface border border-border-default rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">보유 종목</h2>
            <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
              {holdingsSorted.length}
            </span>
          </div>
          <Link href="/portfolio/returns" className="text-xs text-brand-green hover:underline">
            수익률 분석 →
          </Link>
        </div>
        {holdingsSorted.length === 0 ? (
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
                  <th className="text-left px-3 py-2 font-medium text-text-muted text-xs uppercase">종목</th>
                  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden sm:table-cell">비중%</th>
                  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden sm:table-cell">수량</th>
                  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase">현재가</th>
                  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase">평가금액</th>
                  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden md:table-cell">수익</th>
                  <th className="text-right px-3 py-2 font-medium text-text-muted text-xs uppercase">수익률</th>
                  <th className="text-right px-2 py-2 font-medium text-text-muted text-xs uppercase hidden lg:table-cell">목표가</th>
                  <th className="text-center px-2 py-2 font-medium text-text-muted text-xs uppercase hidden lg:table-cell">Conviction</th>
                  <th className="text-left px-2 py-2 font-medium text-text-muted text-xs uppercase hidden xl:table-cell">Next</th>
                </tr>
              </thead>
              <tbody>
                {holdingsSorted.map((h, i) => {
                  const pos = h.returnRate >= 0;
                  const pnlKRW = h.evalAmountKRW - h.costAmountKRW;
                  const pnlPos = pnlKRW >= 0;
                  const isUS = h.currency === "USD";
                  const fmtPrice = (p: number) =>
                    isUS ? `$${p.toFixed(2)}` : `${p.toLocaleString("ko-KR")}`;
                  return (
                    <tr
                      key={h.stockId}
                      className={`border-b border-border-default/30 hover:bg-bg-elevated/25 transition-colors ${i === holdingsSorted.length - 1 ? "border-0" : ""}`}
                    >
                      <td className="px-3 py-3">
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
                      <td className="px-2 py-3 text-right hidden sm:table-cell">
                        <span className="text-sm text-text-secondary">{h.weightPct.toFixed(1)}%</span>
                      </td>
                      <td className="px-2 py-3 text-right hidden sm:table-cell">
                        <span className="text-sm text-text-secondary">{h.quantity.toLocaleString()}</span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <span className="text-sm text-text-primary font-medium">{fmtPrice(h.currentPrice)}</span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <span className="text-sm text-text-primary font-medium">{formatKRW(h.evalAmountKRW)}</span>
                      </td>
                      <td className="px-2 py-3 text-right hidden md:table-cell">
                        <span className={`text-sm font-medium ${pnlPos ? "text-profit-400" : "text-loss-400"}`}>
                          {pnlPos ? "+" : ""}
                          {formatKRW(pnlKRW)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                            pos ? "text-profit-400 bg-profit-bg border border-profit-border" : "text-loss-400 bg-loss-bg border border-loss-border"
                          }`}
                        >
                          {pos ? "+" : ""}
                          {h.returnRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right hidden lg:table-cell">
                        {h.thesis?.fairValueLocal ? (
                          <div>
                            <p className="text-sm text-text-primary">
                              {h.currency === "USD"
                                ? `${h.thesis.fairValueLocal.toLocaleString()}`
                                : `₩${h.thesis.fairValueLocal.toLocaleString()}`}
                            </p>
                            {h.thesis.expectedReturnPct != null && (
                              <p className={`text-xs font-medium mt-0.5 ${h.thesis.expectedReturnPct >= 0 ? "text-profit-400" : "text-loss-400"}`}>
                                {h.thesis.expectedReturnPct >= 0 ? "+" : ""}{h.thesis.expectedReturnPct.toFixed(1)}%
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center hidden lg:table-cell">
                        {h.thesis?.conviction ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            h.thesis.conviction === "High"
                              ? "bg-profit-bg text-profit-400"
                              : h.thesis.conviction === "Mid"
                                ? "bg-brand-green/10 text-brand-green"
                                : "bg-bg-elevated text-text-muted"
                          }`}>
                            {h.thesis.conviction}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 hidden xl:table-cell">
                        <span className="text-xs text-text-secondary line-clamp-1">
                          {h.thesis?.nextCatalyst ?? "—"}
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

      {/* 5. 수익률 막대 + 대출 */}
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

function SummaryPanel({
  summary,
  baseCurrency,
  fxRates,
}: {
  summary: Summary;
  baseCurrency: BaseCurrency;
  fxRates: FxRates;
}) {
  const isPos = summary.totalReturnRate >= 0;
  const pnlKRW = summary.totalEvalKRW - summary.totalCostKRW;

  const rows = [
    {
      label: "총 평가",
      value: formatMoney(summary.totalEvalKRW, baseCurrency, fxRates),
      cls: "text-text-primary text-xl font-bold tabular-nums",
    },
    {
      label: "총 수익",
      value: `${pnlKRW >= 0 ? "+" : ""}${formatMoney(Math.abs(pnlKRW), baseCurrency, fxRates)}`,
      cls: pnlKRW >= 0 ? "text-profit-400 text-lg font-semibold tabular-nums" : "text-loss-400 text-lg font-semibold tabular-nums",
    },
    {
      label: "수익률",
      value: `${isPos ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`,
      cls: isPos ? "text-profit-400 text-base font-semibold tabular-nums" : "text-loss-400 text-base font-semibold tabular-nums",
    },
  ];

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-5 space-y-5 shadow-sm">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{r.label}</p>
          <p className={r.cls}>{r.value}</p>
        </div>
      ))}
      <div className="border-t border-border-default pt-4 space-y-3">
        {summary.alpha !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">Alpha (vs KODEX 200)</span>
            <span className={`text-sm font-semibold tabular-nums ${summary.alpha >= 0 ? "text-profit-400" : "text-loss-400"}`}>
              {summary.alpha >= 0 ? "+" : ""}{summary.alpha.toFixed(2)}%
            </span>
          </div>
        )}
        {summary.benchmarkReturn !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">벤치 (KODEX 200)</span>
            <span className="text-sm text-text-secondary tabular-nums">
              {summary.benchmarkReturn >= 0 ? "+" : ""}{summary.benchmarkReturn.toFixed(2)}%
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">USD/KRW</span>
          <span className="text-sm text-text-secondary tabular-nums">
            {summary.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
            {summary.fxDate && <span className="text-text-muted ml-1 text-xs">{summary.fxDate.slice(5)}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricsStrip({ summary }: { summary: Summary }) {
  const pnlKRW = summary.totalEvalKRW - summary.totalCostKRW;
  const isPos = summary.totalReturnRate >= 0;

  const metrics = [
    {
      label: "총 평가",
      value: formatKRW(summary.totalEvalKRW),
      cls: "text-text-primary",
    },
    {
      label: "수익/손실",
      value: `${pnlKRW >= 0 ? "+" : ""}${formatKRW(pnlKRW)}`,
      cls: pnlKRW >= 0 ? "text-profit-400" : "text-loss-400",
    },
    {
      label: "수익률",
      value: `${isPos ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`,
      cls: isPos ? "text-profit-400" : "text-loss-400",
    },
    ...(summary.alpha !== null ? [{
      label: "Alpha",
      value: `${summary.alpha >= 0 ? "+" : ""}${summary.alpha.toFixed(2)}%`,
      cls: summary.alpha >= 0 ? "text-profit-400" : "text-loss-400",
    }] : []),
    {
      label: "Core / Satellite",
      value: `${summary.totalEvalKRW > 0 ? ((summary.coreKRW / summary.totalEvalKRW) * 100).toFixed(0) : 0}% / ${summary.totalEvalKRW > 0 ? ((summary.satelliteKRW / summary.totalEvalKRW) * 100).toFixed(0) : 0}%`,
      cls: "text-text-secondary",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-bg-surface border border-border-default rounded-xl p-4 shadow-sm">
          <p className="text-xs text-text-muted mb-1">{m.label}</p>
          <p className={`text-sm font-semibold tabular-nums ${m.cls}`}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function DecisionPanel({ holdings }: { holdings: Holding[] }) {
  const withThesis = holdings.filter(
    (h) => h.thesis && h.thesis.action && h.thesis.action !== "관찰"
  );

  if (withThesis.length === 0) return null;

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 space-y-2 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
          오늘의 판단
        </h2>
        <span className="text-xs text-text-muted">리서치 프레임워크 연동</span>
      </div>
      <div className="divide-y divide-border-default/40">
        {withThesis.map((h) => {
          const actionColor =
            h.thesis!.action === "매수" ? "text-profit-400 bg-profit-bg border border-profit-border"
            : h.thesis!.action === "매도" ? "text-loss-400 bg-loss-bg border border-loss-border"
            : "text-brand-green bg-brand-green/8 border border-brand-green/25";
          return (
            <div key={h.stockId} className="py-2 flex items-center gap-3 last:pb-0">
              <div className="w-20 shrink-0">
                <p className="text-sm font-medium text-text-primary truncate">{h.name}</p>
                <p className="text-xs text-text-muted">{h.ticker}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${actionColor}`}>
                {h.thesis!.action}
              </span>
              <p className="text-xs text-text-secondary flex-1 min-w-0 line-clamp-1">
                {h.thesis?.nextCatalyst ?? ""}
              </p>
              {h.thesis?.conviction && (
                <span className="text-xs text-text-muted shrink-0">
                  Conviction: {h.thesis.conviction}
                </span>
              )}
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
