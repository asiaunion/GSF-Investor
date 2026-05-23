"use client";

import type { ReactNode } from "react";
import {
  ReturnBarChart,
  CoreSatelliteDonut,
  WeightDonut,
  SectorDonut,
  formatKRW,
} from "@/components/DashboardCharts";
import { formatMoney, type BaseCurrency, type FxRates } from "@/lib/format-money";
import NetWorthHistoryChart from "@/components/NetWorthHistoryChart";
import PortfolioPerformanceChart from "@/components/PortfolioPerformanceChart";
import ActivityTimeline, { type ActivityItem } from "@/components/ActivityTimeline";
import Link from "next/link";
import StockIdentity from "@/components/StockIdentity";
import { PnlMethodHint } from "@/components/PnlMethodHint";
import { economistCard, severityConfig } from "@/lib/economist-ui";

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

  const donutData = [
    { name: "Core", valueKRW: summary.coreKRW, pct: summary.totalEvalKRW > 0 ? (summary.coreKRW / summary.totalEvalKRW) * 100 : 0 },
    { name: "Satellite", valueKRW: summary.satelliteKRW, pct: summary.totalEvalKRW > 0 ? (summary.satelliteKRW / summary.totalEvalKRW) * 100 : 0 },
  ].filter((d) => d.valueKRW > 0);

  const barData = holdings.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    returnRate: h.returnRate,
  }));

  const isPositive = summary.totalReturnRate >= 0;
  const isAlphaPositive = (summary.alpha ?? 0) >= 0;
  const pnl = summary.totalEvalKRW - summary.totalCostKRW;
  const coreCount = holdings.filter((h) => h.category === "Core").length;
  const satCount = holdings.filter((h) => h.category === "Satellite").length;
  const corePct = summary.totalEvalKRW > 0 ? (summary.coreKRW / summary.totalEvalKRW) * 100 : 0;
  const satPct = summary.totalEvalKRW > 0 ? (summary.satelliteKRW / summary.totalEvalKRW) * 100 : 0;

  const totalLoan = loans.reduce((s, l) => s + l.loanAmount, 0);
  const totalAnnual = loans.reduce((s, l) => s + l.annualInterest, 0);
  const ltvPct = summary.totalEvalKRW > 0 ? (totalLoan / summary.totalEvalKRW) * 100 : 0;

  return (
    <div className="space-y-3">

      {/* KPI 스트립 */}
      <div className={`${economistCard} px-4 py-3 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-green/4 via-transparent to-brand-green/4 pointer-events-none" />
        <div className="relative grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-3 gap-y-2 lg:divide-x divide-border-default">
          <HeroMetric emphasis label="총 평가" value={fmt(summary.totalEvalKRW)} sub={`원가 ${fmt(summary.totalCostKRW)}`} />
          <HeroMetric
            emphasis
            label="총 수익률"
            labelExtra={<PnlMethodHint method="weighted_avg" />}
            value={`${isPositive ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`}
            sub={`수익 ${isPositive ? "+" : ""}${fmt(pnl)}`}
            valueClass={isPositive ? "text-profit-400" : "text-loss-400"}
          />
          <HeroMetric
            emphasis
            label="Alpha"
            value={summary.alpha !== null ? `${isAlphaPositive ? "+" : ""}${summary.alpha.toFixed(2)}%` : "—"}
            sub={
              summary.benchmarkReturn !== null
                ? `벤치 ${summary.benchmarkReturn >= 0 ? "+" : ""}${summary.benchmarkReturn.toFixed(2)}%`
                : "069500"
            }
            valueClass={summary.alpha !== null ? (isAlphaPositive ? "text-profit-400" : "text-warn-400") : "text-text-disabled"}
          />
          <MiniStat label="종목" value={`${holdings.length}`} sub={`Core ${coreCount} · Sat ${satCount}`} />
          <MiniStat
            label="USD/KRW"
            value={summary.usdKrw > 0 ? summary.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : "—"}
            sub={summary.fxDate ? summary.fxDate.slice(5) : "—"}
          />
          <MiniStat label="Core" value={`${corePct.toFixed(0)}%`} sub={fmt(summary.coreKRW)} accent="green" />
          <MiniStat label="Sat" value={`${satPct.toFixed(0)}%`} sub={fmt(summary.satelliteKRW)} accent="blue" />
        </div>
      </div>

      <NetWorthHistoryChart baseCurrency={baseCurrency} fxRates={fxRates} />

      <PortfolioPerformanceChart />

      {/* 차트 4종 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 overflow-visible">
        <ChartPanel title="수익률" hint="매입가" variant="bar">
          {barData.length > 0 ? <ReturnBarChart data={barData} /> : <EmptyState message="보유 없음" cta={{ label: "일지", href: "/journal" }} />}
        </ChartPanel>
        <ChartPanel title="Core/Sat" hint="평가" variant="donut">
          {donutData.length > 0 ? <CoreSatelliteDonut data={donutData} /> : <EmptyState message="보유 없음" />}
        </ChartPanel>
        {contribData.length > 0 && (
          <>
            <ChartPanel title="비중" hint="%" variant="donut">
              <WeightDonut data={contribData} />
            </ChartPanel>
            <ChartPanel title="섹터" hint="평가" variant="donut">
              {sectorData.length > 0 ? <SectorDonut data={sectorData} /> : <EmptyState message="섹터 미입력" cta={{ label: "설정", href: "/settings" }} />}
            </ChartPanel>
          </>
        )}
      </div>

      {/* 보유 종목 */}
      <div className={`${economistCard} overflow-hidden`}>
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
                <tr className="border-b border-border-default bg-bg-elevated/40">
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
                      className={`border-b border-border-default/40 hover:bg-bg-elevated/25 ${i === holdings.length - 1 ? "border-0" : ""}`}
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
                          className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                            pos ? "text-profit-400 bg-profit-bg" : "text-loss-400 bg-loss-bg"
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

      {/* 활동 + 대출 + 시그널 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ActivityTimeline items={activityItems} />
        <div className={`${economistCard} overflow-hidden`}>
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

        <div className={`${economistCard} overflow-hidden`}>
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

function HeroMetric({
  label,
  labelExtra,
  value,
  sub,
  valueClass = "text-text-primary",
  emphasis = false,
}: {
  label: string;
  labelExtra?: ReactNode;
  value: string;
  sub: string;
  valueClass?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="lg:px-2 min-w-0">
      <p className={`${emphasis ? "text-xs" : "text-[11px]"} text-text-muted leading-none mb-0.5 flex items-center gap-1 flex-wrap`}>
        {label}
        {labelExtra}
      </p>
      <p
        className={`${emphasis ? "text-lg sm:text-xl" : "text-base"} font-bold tabular-nums leading-tight truncate ${valueClass}`}
      >
        {value}
      </p>
      <p className={`${emphasis ? "text-xs" : "text-[11px]"} text-text-muted truncate leading-tight`}>{sub}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "green" | "blue";
}) {
  const valueCls =
    accent === "green" ? "text-brand-green" : accent === "blue" ? "text-brand-blue" : "text-text-primary";
  return (
    <div className="lg:px-2 min-w-0">
      <p className="text-xs text-text-muted leading-none mb-0.5">{label}</p>
      <p className={`text-base font-bold tabular-nums leading-tight ${valueCls}`}>{value}</p>
      <p className="text-xs text-text-muted truncate leading-tight">{sub}</p>
    </div>
  );
}

function ChartPanel({
  title,
  hint,
  children,
  variant,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  variant?: "bar" | "donut";
}) {
  const isChart = variant === "bar" || variant === "donut";
  return (
    <div
      className={`${economistCard} px-2.5 pt-2 ${
        isChart ? "pb-2 overflow-visible" : "pb-1"
      } ${isChart ? "min-h-[220px] flex flex-col" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-1 mb-1.5 px-0.5 shrink-0">
        <h2 className="text-xs font-semibold text-text-primary">{title}</h2>
        <span className="text-[11px] text-text-muted">{hint}</span>
      </div>
      <div className={isChart ? "overflow-visible flex flex-col flex-1 min-h-0" : undefined}>{children}</div>
    </div>
  );
}

function EmptyState({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="h-20 flex flex-col items-center justify-center gap-1 text-text-muted text-xs">
      <span>{message}</span>
      {cta && (
        <a href={cta.href} className="text-brand-green/80 hover:text-brand-green underline">
          {cta.label}
        </a>
      )}
    </div>
  );
}
