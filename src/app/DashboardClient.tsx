"use client";

import {
  ReturnBarChart,
  CoreSatelliteDonut,
  WeightedContributionChart,
  SectorDonut,
  formatKRW,
} from "@/components/DashboardCharts";
import Link from "next/link";

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
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function DashboardClient({ data, recentSignals, contribData, sectorData, loans }: Props) {
  const { holdings, summary } = data;

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

  return (
    <div className="space-y-6">

      {/* ── Phase A: 히어로 메트릭 배너 ─────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
        {/* 배경 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-violet-500/5 rounded-2xl pointer-events-none" />

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 sm:divide-x divide-zinc-800">
          {/* 총 평가금액 */}
          <div className="sm:pr-6">
            <p className="text-xs font-medium text-zinc-500 mb-1.5">총 평가금액</p>
            <p className="text-3xl font-bold text-white tracking-tight tabular-nums">
              {formatKRW(summary.totalEvalKRW)}
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              매입원가 {formatKRW(summary.totalCostKRW)}
            </p>
          </div>

          {/* 총 수익률 */}
          <div className="sm:px-6">
            <p className="text-xs font-medium text-zinc-500 mb-1.5">총 수익률</p>
            <p className={`text-3xl font-bold tracking-tight tabular-nums ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{summary.totalReturnRate.toFixed(2)}%
            </p>
            <p className={`text-xs mt-1 ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}{formatKRW(pnl)}
            </p>
          </div>

          {/* Alpha (vs KODEX 200) */}
          <div className="sm:pl-6">
            <p className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
              Alpha
              <span className="text-zinc-700 font-normal">(vs KODEX 200)</span>
            </p>
            {summary.alpha !== null ? (
              <>
                <p className={`text-3xl font-bold tracking-tight tabular-nums ${isAlphaPositive ? "text-violet-400" : "text-amber-400"}`}>
                  {isAlphaPositive ? "+" : ""}{summary.alpha.toFixed(2)}%
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  벤치마크 {summary.benchmarkReturn !== null ? `${summary.benchmarkReturn >= 0 ? "+" : ""}${summary.benchmarkReturn.toFixed(2)}%` : "—"}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold tracking-tight text-zinc-700">—</p>
                <p className="text-xs text-zinc-700 mt-1">
                  KODEX 200(069500) watchlist 등록 필요
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 요약 메트릭 4개 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="보유 종목"
          value={`${holdings.length}종목`}
          sub={`Core ${holdings.filter((h) => h.category === "Core").length} · Sat ${holdings.filter((h) => h.category === "Satellite").length}`}
          accent="violet"
        />
        <MetricCard
          label="USD/KRW"
          value={summary.usdKrw > 0 ? summary.usdKrw.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : "—"}
          sub={summary.fxDate ? `기준일 ${summary.fxDate.slice(5)}` : "—"}
          accent="amber"
        />
        <MetricCard
          label="Core 비중"
          value={summary.totalEvalKRW > 0 ? `${((summary.coreKRW / summary.totalEvalKRW) * 100).toFixed(0)}%` : "—"}
          sub={formatKRW(summary.coreKRW)}
          accent="emerald"
        />
        <MetricCard
          label="Satellite 비중"
          value={summary.totalEvalKRW > 0 ? `${((summary.satelliteKRW / summary.totalEvalKRW) * 100).toFixed(0)}%` : "—"}
          sub={formatKRW(summary.satelliteKRW)}
          accent="indigo"
        />
      </div>

      {/* ── Row 1: 수익률 바 차트 + Core/Satellite 도넛 ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 수익률 바 차트 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">종목별 수익률</h2>
            <span className="text-xs text-zinc-500">평균매입가 기준</span>
          </div>
          {barData.length > 0 ? (
            <ReturnBarChart data={barData} />
          ) : (
            <EmptyState
              message="보유 종목 없음"
              cta={{ label: "매매 일지에서 종목 추가", href: "/journal" }}
            />
          )}
        </div>

        {/* Core vs Satellite 도넛 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Core vs Satellite</h2>
            <span className="text-xs text-zinc-500">평가금액 기준</span>
          </div>
          {donutData.length > 0 ? (
            <CoreSatelliteDonut data={donutData} />
          ) : (
            <EmptyState
              message="보유 종목 없음"
              cta={{ label: "매매 일지에서 종목 추가", href: "/journal" }}
            />
          )}
        </div>
      </div>

      {/* ── B-1+B-2: Weighted Contribution + Sector 집중도 ──────────────── */}
      {contribData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 포트폴리오 기여도 (비중 bar) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">포트폴리오 기여도</h2>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Core
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" /> Satellite
                </span>
              </div>
            </div>
            <WeightedContributionChart data={contribData} />
          </div>

          {/* 섹터 집중도 도넛 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">섹터 집중도</h2>
              <span className="text-xs text-zinc-500">평가금액 기준</span>
            </div>
            {sectorData.length > 0 ? (
              <SectorDonut data={sectorData} />
            ) : (
              <EmptyState
                message="섹터 정보 미입력"
                cta={{ label: "Settings에서 섹터 지정", href: "/settings" }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── 보유 종목 현황 테이블 ────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">보유 종목 현황</h2>
          <Link
            href="/journal"
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            매매 일지 →
          </Link>
        </div>
        {holdings.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-zinc-500 text-sm mb-3">아직 보유 종목이 없습니다.</p>
            <Link
              href="/journal"
              className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              + 매매 일지에서 INIT 레코드 추가
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500">종목</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">수량</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">평균단가</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">현재가</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">평가금액</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500">수익률</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  const pos = h.returnRate >= 0;
                  const isUS = h.currency === "USD";
                  return (
                    <tr
                      key={h.stockId}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${i === holdings.length - 1 ? "border-0" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-7 rounded-full ${h.category === "Core" ? "bg-emerald-500/60" : "bg-indigo-500/60"}`} />
                          <div>
                            <p className="text-white font-medium">{h.ticker}</p>
                            <p className="text-xs text-zinc-500">
                              {h.name} · {h.category}
                              {h.sector && <span className="text-zinc-600"> · {h.sector}</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3.5 text-zinc-300 tabular-nums">
                        {h.quantity.toLocaleString()}주
                      </td>
                      <td className="text-right px-4 py-3.5 text-zinc-400 tabular-nums text-xs">
                        {isUS
                          ? `$${h.avgPrice.toFixed(2)}`
                          : `${h.avgPrice.toLocaleString("ko-KR")}원`}
                      </td>
                      <td className="text-right px-4 py-3.5 text-zinc-300 tabular-nums text-xs">
                        {isUS
                          ? `$${h.currentPrice.toFixed(2)}`
                          : `${h.currentPrice.toLocaleString("ko-KR")}원`}
                        {h.priceDate && (
                          <span className="block text-zinc-600" style={{ fontSize: "10px" }}>
                            {h.priceDate.slice(5)}
                          </span>
                        )}
                      </td>
                      <td className="text-right px-4 py-3.5 text-zinc-300 tabular-nums">
                        {formatKRW(h.evalAmountKRW)}
                        {isUS && (
                          <span className="block text-zinc-500 text-xs">
                            ${(h.currentPrice * h.quantity).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </td>
                      <td className="text-right px-5 py-3.5 tabular-nums font-semibold">
                        <span
                          className={`inline-flex items-center justify-end gap-0.5 px-2 py-0.5 rounded-lg text-xs ${
                            pos
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {pos ? "▲" : "▼"} {Math.abs(h.returnRate).toFixed(2)}%
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

      {/* ── 주식담보대출 현황 ────────────────────────────────────────────── */}
      {(() => {
        const totalLoan = loans.reduce((s, l) => s + l.loanAmount, 0);
        const totalAnnual = loans.reduce((s, l) => s + l.annualInterest, 0);
        const totalMonthly = totalAnnual / 12;
        const ltvPct = summary.totalEvalKRW > 0 ? (totalLoan / summary.totalEvalKRW) * 100 : 0;
        return (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                대출 현황 (주식담보)
              </h2>
              <Link
                href="/settings"
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                관리 →
              </Link>
            </div>

            {loans.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-zinc-600 text-sm">등록된 대출이 없습니다</p>
                <Link href="/settings" className="text-xs text-emerald-500/70 hover:text-emerald-400 mt-2 inline-block">
                  Settings → 대출 추가
                </Link>
              </div>
            ) : (
              <>
                {/* 요약 스트립 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-zinc-800 border-b border-zinc-800">
                  {[
                    { label: "전체 대출원금", value: formatKRW(totalLoan), color: "text-orange-400" },
                    { label: "연간 이자합계", value: formatKRW(Math.round(totalAnnual)), color: "text-red-400" },
                    { label: "월평균 이자", value: formatKRW(Math.round(totalMonthly)), color: "text-amber-400" },
                    { label: "LTV (대출/평가)", value: `${ltvPct.toFixed(1)}%`, color: ltvPct > 60 ? "text-red-400" : "text-zinc-300" },
                  ].map((item) => (
                    <div key={item.label} className="px-5 py-4">
                      <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
                      <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* 대출 항목 리스트 */}
                <div className="divide-y divide-zinc-800/50">
                  {loans.map((loan) => (
                    <div key={loan.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-white">{loan.label}</span>
                          {loan.ticker && (
                            <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                              {loan.ticker} 담보
                            </span>
                          )}
                          {loan.startedAt && (
                            <span className="text-xs text-zinc-600">시작: {loan.startedAt}</span>
                          )}
                        </div>
                        {loan.note && <p className="text-xs text-zinc-600">{loan.note}</p>}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-sm font-semibold text-orange-400 tabular-nums">
                          {formatKRW(loan.loanAmount)}
                        </p>
                        <p className="text-xs text-zinc-500 tabular-nums">
                          연{loan.interestRate}% · 월{formatKRW(Math.round(loan.monthlyInterest))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── 최근 시그널 타임라인 ─────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            최근 시그널
            {recentSignals.filter((s) => s.isResolved === 0 && s.severity === "HIGH").length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
            )}
          </h2>
          <Link
            href="/signals"
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            전체 보기 →
          </Link>
        </div>
        {recentSignals.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-zinc-600 text-sm mb-2">수집된 시그널이 없습니다</p>
            <p className="text-zinc-700 text-xs">DART/SEC 크론잡 확인 또는 /discover에서 체크리스트 실행</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {recentSignals.map((s) => {
              const sevMap: Record<string, { dot: string; text: string; bg: string }> = {
                HIGH:   { dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-500/5" },
                MEDIUM: { dot: "bg-amber-400",  text: "text-amber-400",  bg: "bg-amber-500/5" },
                LOW:    { dot: "bg-zinc-500",   text: "text-zinc-400",   bg: "" },
              };
              const sev = sevMap[s.severity] ?? sevMap.LOW;
              return (
                <div
                  key={s.id}
                  className={`px-5 py-3.5 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors ${sev.bg} ${
                    s.isResolved ? "opacity-50" : ""
                  }`}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sev.dot} ${s.isResolved === 0 && s.severity === "HIGH" ? "animate-pulse" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold ${sev.text}`}>{s.severity}</span>
                      <span className="text-xs text-zinc-500">{s.ticker}</span>
                      <span className="text-xs text-zinc-700">·</span>
                      <span className="text-xs text-zinc-600">{s.detectedAt?.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-1">{s.description}</p>
                  </div>
                  {s.isResolved === 1 && (
                    <span className="text-xs text-zinc-600 shrink-0">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

type Accent = "emerald" | "red" | "violet" | "amber" | "indigo";

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: Accent;
}) {
  const accentMap: Record<Accent, { bg: string; border: string; text: string }> = {
    emerald: { bg: "bg-emerald-500/8",  border: "border-emerald-500/15", text: "text-emerald-400" },
    red:     { bg: "bg-red-500/8",      border: "border-red-500/15",     text: "text-red-400" },
    violet:  { bg: "bg-violet-500/8",   border: "border-violet-500/15",  text: "text-violet-400" },
    amber:   { bg: "bg-amber-500/8",    border: "border-amber-500/15",   text: "text-amber-400" },
    indigo:  { bg: "bg-indigo-500/8",   border: "border-indigo-500/15",  text: "text-indigo-400" },
  };
  const c = accentMap[accent];

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <p className="text-xs text-zinc-500 font-medium mb-1.5">{label}</p>
      <p className={`text-lg font-bold ${c.text} tabular-nums`}>{value}</p>
      <p className="text-xs text-zinc-600 mt-1 truncate">{sub}</p>
    </div>
  );
}

function EmptyState({ message, cta }: { message: string; cta?: { label: string; href: string } }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-zinc-600 text-sm">
      <span>{message}</span>
      {cta && (
        <a
          href={cta.href}
          className="text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors underline underline-offset-2"
        >
          {cta.label}
        </a>
      )}
    </div>
  );
}
