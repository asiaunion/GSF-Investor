"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PnlMethodHint } from "@/components/PnlMethodHint";

const ConfidenceTrend = dynamic(
  () => import("./ConfidenceTrend"),
  { ssr: false, loading: () => <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6 animate-pulse h-56" /> }
);

const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface EmotionStat {
  tag: string;
  count: number;
  buyCount: number;
  sellCount: number;
  totalRealizedPnl: number;
  avgReturnPct: number | null;
  winCount: number;
  lossCount: number;
}

interface RealizedTrade {
  id: number;
  ticker: string | null;
  name: string | null;
  tradedAt: string;
  quantity: number;
  sellPrice: number;
  avgBuyPrice: number;
  realizedPnl: number;
  loanInterest: number;
  netPnl: number;
  returnPct: number;
  returnPctGross: number;
  currency: string | null;
  emotionTag: string | null;
}

interface AnalyticsData {
  summary: {
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    totalRealizedPnl: number;
    totalLoanInterest: number;
    totalNetPnl: number;
    winRate: number | null;
    winTrades: number;
    lossTrades: number;
  };
  emotionStats: EmotionStat[];
  realizedTrades: RealizedTrade[];
  categoryBreakdown: { core: number; satellite: number };
  benchmarkPerformance?: {
    ticker: string;
    periodReturnPct: number | null;
    volatilityPct: number | null;
    maxDrawdownPct: number | null;
    sharpe: number | null;
  } | null;
}

// ── Color maps ────────────────────────────────────────────────────────────────
const emotionColors: Record<string, string> = {
  확신: "var(--color-brand-green)",
  계획적: "#3b82f6",
  불안: "var(--color-warn-500)",
  충동: "#ef4444",
};
const emotionBgStyles: Record<string, string> = {
  확신: "text-[var(--color-brand-green)] bg-brand-green/10 border-brand-green/20",
  계획적: "text-brand-green bg-brand-green/10 border-brand-green/20",
  불안: "text-warn-400 bg-warn-bg border-warn-border/20",
  충동: "text-loss-400 bg-loss-bg border-loss-border/20",
};

function fmtPnl(v: number, currency: string | null = "KRW") {
  if (currency === "USD") return `${v >= 0 ? "+" : ""}$${v.toFixed(0)}`;
  return `${v >= 0 ? "+" : ""}₩${Math.round(v).toLocaleString("ko-KR")}`;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload }: { active?: boolean; payload?: { payload: EmotionStat; value: number }[] }) {
  if (!active || !payload?.[0]) return null;
  const { payload: stat, value } = payload[0];
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-xl px-4 py-3 text-xs shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ background: emotionColors[stat.tag] ?? "#71717a" }}
        />
        <span className="font-bold text-[var(--color-text-primary)]">{stat.tag}</span>
      </div>
      <div className="space-y-1 text-[var(--color-text-secondary)]">
        <div>평균 수익률: <span className={value >= 0 ? "text-[var(--color-brand-green)] font-bold" : "text-loss-400 font-bold"}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span></div>
        <div>SELL 건수: <span className="text-[var(--color-text-primary)]">{stat.sellCount}건</span></div>
        <div>승률: <span className="text-[var(--color-text-primary)]">{stat.sellCount > 0 ? ((stat.winCount / stat.sellCount) * 100).toFixed(0) : "—"}%</span></div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JournalAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"손익 분석" | "확신도 추이">("손익 분석");

  useEffect(() => {
    fetch("/api/journal/analytics")
      .then((r) => {
        if (!r.ok) throw new Error("API 오류");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6 text-[var(--color-text-muted)] text-sm">
        분석 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  const { summary, emotionStats, realizedTrades, categoryBreakdown, benchmarkPerformance } = data;

  // 차트 데이터 (avgReturnPct가 있는 감정만)
  const chartData = emotionStats
    .filter((s) => s.avgReturnPct !== null)
    .map((s) => ({ ...s, value: s.avgReturnPct ?? 0 }));

  return (
    <div className="space-y-5">
      {/* ── 서브탭 바 ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--color-border-default)] pb-1">
        {(["손익 분석", "확신도 추이"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === tab
                ? "bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)] font-bold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]/50"
            }`}
          >
            {tab === "손익 분석" ? "📊 손익 분석" : "🎯 확신도 추이"}
          </button>
        ))}
      </div>

      {/* ── 확신도 추이 탭 ───────────────────────────────────────────────────── */}
      {subTab === "확신도 추이" && <ConfidenceTrend />}

      {/* ── 손익 분석 탭 ─────────────────────────────────────────────────────── */}
      {subTab === "손익 분석" && (
      <div className="space-y-5">

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="font-medium text-text-secondary">실현 손익 요약</span>
        <PnlMethodHint method="fifo" />
      </div>

      {/* ── 전체 요약 카드 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "순 실현 손익",
            value: summary.totalNetPnl !== 0
              ? fmtPnl(summary.totalNetPnl)
              : "—",
            color: (summary.totalNetPnl ?? 0) >= 0
              ? "text-[var(--color-brand-green)]"
              : "text-loss-400",
            sub: summary.totalLoanInterest > 0
              ? `이자 ${fmtPnl(-summary.totalLoanInterest)} 차감`
              : undefined,
          },
          {
            label: "승률",
            value: summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : "—",
            color: (summary.winRate ?? 0) >= 50 ? "text-[var(--color-brand-green)]" : "text-loss-400",
            sub: undefined,
          },
          {
            label: "승 / 패",
            value: summary.sellCount > 0
              ? `${summary.winTrades}W · ${summary.lossTrades}L`
              : "—",
            color: "text-[var(--color-text-primary)]",
            sub: undefined,
          },
          {
            label: "Core / Satellite",
            value: `${categoryBreakdown.core} / ${categoryBreakdown.satellite}`,
            color: "text-[var(--color-text-primary)]",
            sub: undefined,
          },
        ].map((card) => (
          <div key={card.label} className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-4">
            <div className="text-[var(--color-text-disabled)] text-[10px] uppercase tracking-wider mb-1.5">{card.label}</div>
            <div className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</div>
            {card.sub && (
              <div className="text-[10px] text-loss-400/70 mt-0.5">{card.sub}</div>
            )}
          </div>
        ))}
      </div>
      {benchmarkPerformance && (
        <div className="bg-bg-surface border-t-4 border-t-brand-green border border-border-default rounded-sm shadow-sm p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            벤치마크 성과 ({benchmarkPerformance.ticker})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: "기간 수익률", value: benchmarkPerformance.periodReturnPct, suffix: "%" },
              { label: "연환산 변동성", value: benchmarkPerformance.volatilityPct, suffix: "%" },
              { label: "MDD", value: benchmarkPerformance.maxDrawdownPct, suffix: "%" },
              { label: "샤프(근사)", value: benchmarkPerformance.sharpe, suffix: "" },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-text-muted">{m.label}</div>
                <div className="font-bold text-text-primary tabular-nums">
                  {m.value != null ? `${m.value.toFixed(2)}${m.suffix}` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 감정별 수익률 차트 ──────────────────────────────────────────────── */}
      {chartData.length > 0 ? (
        <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">감정별 평균 수익률</h3>
            <span className="text-xs text-[var(--color-text-disabled)]">SELL 거래 기준 · FIFO + 이자 반영</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="tag"
                tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.tag}
                    fill={entry.value >= 0
                      ? (emotionColors[entry.tag] ?? "var(--color-brand-green)")
                      : "#ef4444"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {/* ── 감정 태그별 상세 카드 ───────────────────────────────────────────── */}
      {emotionStats.length > 0 && (
        <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">감정 태그 분석</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {emotionStats.map((stat) => (
              <div
                key={stat.tag}
                className="flex items-start gap-3 bg-[var(--color-bg-elevated)]/40 border border-[var(--color-border-strong)]/30 rounded-xl p-4"
              >
                <span
                  className={`shrink-0 inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border ${emotionBgStyles[stat.tag] ?? "text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] border-[var(--color-border-strong)]"}`}
                >
                  {stat.tag}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">총 거래</span>
                    <span className="text-[var(--color-text-primary)] font-medium">{stat.count}건</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">매수 / 매도</span>
                    <span className="text-[var(--color-text-primary)]">{stat.buyCount} / {stat.sellCount}</span>
                  </div>
                  {stat.sellCount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">평균 수익률</span>
                        <span
                          className={`font-bold ${(stat.avgReturnPct ?? 0) >= 0 ? "text-[var(--color-brand-green)]" : "text-loss-400"}`}
                        >
                          {stat.avgReturnPct != null
                            ? `${stat.avgReturnPct >= 0 ? "+" : ""}${stat.avgReturnPct.toFixed(2)}%`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">실현 손익</span>
                        <span
                          className={`font-medium ${stat.totalRealizedPnl >= 0 ? "text-[var(--color-brand-green)]" : "text-loss-400"}`}
                        >
                          {fmtPnl(stat.totalRealizedPnl)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">승 / 패</span>
                        <span className="text-[var(--color-text-primary)]">
                          <span className="text-[var(--color-brand-green)]">{stat.winCount}W</span>
                          <span className="text-[var(--color-text-disabled)] mx-1">·</span>
                          <span className="text-loss-400">{stat.lossCount}L</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 실현 손익 거래 내역 ─────────────────────────────────────────────── */}
      {realizedTrades.length > 0 && (
        <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm">
          <div className="px-5 py-4 border-b border-[var(--color-border-default)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">실현 손익 내역</h3>
            <span className="text-xs text-[var(--color-text-disabled)]">FIFO 기준 · 이자 반영 · 최근 20건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  {["날짜", "종목", "수량", "평균 매수가", "매도가", "세전 손익", "융자 이자", "순손익", "수익률", "감정"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[var(--color-text-disabled)] font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/40">
                {realizedTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-bg-elevated)]/20 transition-colors">
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{t.tradedAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[var(--color-text-primary)] font-mono font-semibold">{t.ticker}</span>
                        <span className="text-[var(--color-text-disabled)]">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)] tabular-nums">
                      {t.quantity.toLocaleString("ko-KR")}주
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] tabular-nums">
                      ₩{Math.round(t.avgBuyPrice).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] tabular-nums">
                      ₩{t.sellPrice.toLocaleString("ko-KR")}
                    </td>
                    <td className={`px-4 py-3 font-medium tabular-nums ${t.realizedPnl >= 0 ? "text-[var(--color-text-primary)]" : "text-red-300"}`}>
                      {fmtPnl(t.realizedPnl)}
                    </td>
                    <td className={`px-4 py-3 tabular-nums ${
                      t.loanInterest > 0 ? "text-loss-400" : "text-[var(--color-text-disabled)]"
                    }`}>
                      {t.loanInterest > 0 ? `-₩${Math.round(t.loanInterest).toLocaleString("ko-KR")}` : "—"}
                    </td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${t.netPnl >= 0 ? "text-[var(--color-brand-green)]" : "text-loss-400"}`}>
                      {fmtPnl(t.netPnl)}
                    </td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${t.returnPct >= 0 ? "text-[var(--color-brand-green)]" : "text-loss-400"}`}>
                      {t.returnPct >= 0 ? "+" : ""}{t.returnPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      {t.emotionTag && (
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${emotionBgStyles[t.emotionTag] ?? "text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] border-[var(--color-border-strong)]"}`}
                        >
                          {t.emotionTag}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {realizedTrades.length === 0 && (
        <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-8 text-center">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-[var(--color-text-muted)] text-sm">SELL 거래 기록 후 실현 손익 분석이 표시됩니다.</p>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
