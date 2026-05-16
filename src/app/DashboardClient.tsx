"use client";

import { ReturnBarChart, CoreSatelliteDonut, formatKRW } from "@/components/DashboardCharts";
import Link from "next/link";

interface Holding {
  stockId: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
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
  usdkrw: number;
  fxDate: string | null;
  coreKRW: number;
  satelliteKRW: number;
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

interface Props {
  data: { holdings: Holding[]; summary: Summary };
  recentSignals: RecentSignal[];
}

export default function DashboardClient({ data, recentSignals }: Props) {
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

  return (
    <div className="space-y-6">
      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 총 평가금액 */}
        <SummaryCard
          label="총 평가금액"
          value={formatKRW(summary.totalEvalKRW)}
          sub={`매입원가 ${formatKRW(summary.totalCostKRW)}`}
          accent="emerald"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          }
        />
        {/* 총 수익률 */}
        <SummaryCard
          label="총 수익률"
          value={`${isPositive ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`}
          sub={`손익 ${isPositive ? "+" : ""}${formatKRW(summary.totalEvalKRW - summary.totalCostKRW)}`}
          accent={isPositive ? "emerald" : "red"}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          }
        />
        {/* 종목 수 */}
        <SummaryCard
          label="보유 종목"
          value={`${holdings.length}종목`}
          sub={`Core ${holdings.filter((h) => h.category === "Core").length} · Satellite ${holdings.filter((h) => h.category === "Satellite").length}`}
          accent="violet"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
          }
        />
      </div>

      {/* 차트 섹션 */}
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
            <EmptyState message="보유 종목 없음" />
          )}
        </div>

        {/* 도넛 차트 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Core vs Satellite</h2>
            <span className="text-xs text-zinc-500">평가금액 기준</span>
          </div>
          {donutData.length > 0 ? (
            <CoreSatelliteDonut data={donutData} />
          ) : (
            <EmptyState message="보유 종목 없음" />
          )}
        </div>
      </div>

      {/* 종목별 상세 테이블 */}
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
          <div className="px-5 py-12 text-center text-zinc-500 text-sm">
            아직 보유 종목이 없습니다. 매매 일지에서 INIT 레코드를 추가하세요.
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
                            <p className="text-xs text-zinc-500">{h.name} · {h.category}</p>
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

      {/* 최근 시그널 타임라인 */}
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
          <div className="px-5 py-10 text-center text-zinc-600 text-sm">
            수집된 시그널이 없습니다 — DART/SEC 크론잡 확인
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {recentSignals.map((s) => {
              const sevMap: Record<string, { dot: string; text: string }> = {
                HIGH: { dot: "bg-red-500", text: "text-red-400" },
                MEDIUM: { dot: "bg-amber-400", text: "text-amber-400" },
                LOW: { dot: "bg-emerald-500", text: "text-emerald-400" },
              };
              const sev = sevMap[s.severity] ?? sevMap.LOW;
              return (
                <div
                  key={s.id}
                  className={`px-5 py-3.5 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors ${
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

// ── 요약 카드 컴포넌트 ─────────────────────────────────────────────────────────
type Accent = "emerald" | "red" | "violet" | "amber";

function SummaryCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  accent: Accent;
  icon: React.ReactNode;
}) {
  const accentMap: Record<Accent, { bg: string; border: string; text: string; icon: string }> = {
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "text-emerald-400" },
    red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: "text-red-400" },
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", icon: "text-violet-400" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: "text-amber-400" },
  };
  const c = accentMap[accent];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
      <div className={`absolute inset-0 ${c.bg} opacity-20 rounded-2xl`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-6 h-6 rounded-md ${c.bg} border ${c.border} flex items-center justify-center ${c.icon}`}>
            {icon}
          </div>
          <p className="text-xs text-zinc-400 font-medium">{label}</p>
        </div>
        <p className={`text-2xl font-bold ${c.text} tracking-tight`}>{value}</p>
        <p className="text-xs text-zinc-600 mt-1.5">{sub}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-zinc-600 text-sm">
      {message}
    </div>
  );
}
