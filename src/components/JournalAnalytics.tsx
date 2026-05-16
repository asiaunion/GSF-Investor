"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ConfidenceTrend = dynamic(
  () => import("./ConfidenceTrend"),
  { ssr: false, loading: () => <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-pulse h-56" /> }
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
  returnPct: number;
  currency: string | null;
  emotionTag: string | null;
}

interface AnalyticsData {
  summary: {
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    totalRealizedPnl: number;
    winRate: number | null;
    winTrades: number;
    lossTrades: number;
  };
  emotionStats: EmotionStat[];
  realizedTrades: RealizedTrade[];
  categoryBreakdown: { core: number; satellite: number };
}

// ── Color maps ────────────────────────────────────────────────────────────────
const emotionColors: Record<string, string> = {
  확신: "#10b981",
  계획적: "#3b82f6",
  불안: "#f59e0b",
  충동: "#ef4444",
};
const emotionBgStyles: Record<string, string> = {
  확신: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  계획적: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  불안: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  충동: "text-red-400 bg-red-500/10 border-red-500/20",
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
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ background: emotionColors[stat.tag] ?? "#71717a" }}
        />
        <span className="font-bold text-white">{stat.tag}</span>
      </div>
      <div className="space-y-1 text-zinc-400">
        <div>평균 수익률: <span className={value >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{value >= 0 ? "+" : ""}{value.toFixed(2)}%</span></div>
        <div>SELL 건수: <span className="text-zinc-200">{stat.sellCount}건</span></div>
        <div>승률: <span className="text-zinc-200">{stat.sellCount > 0 ? ((stat.winCount / stat.sellCount) * 100).toFixed(0) : "—"}%</span></div>
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
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-zinc-500 text-sm">
        분석 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  const { summary, emotionStats, realizedTrades, categoryBreakdown } = data;

  // 차트 데이터 (avgReturnPct가 있는 감정만)
  const chartData = emotionStats
    .filter((s) => s.avgReturnPct !== null)
    .map((s) => ({ ...s, value: s.avgReturnPct ?? 0 }));

  return (
    <div className="space-y-5">
      {/* ── 서브탭 바 ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-zinc-800 pb-1">
        {(["손익 분석", "확신도 추이"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === tab
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
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
      {/* ── 전체 요약 카드 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "총 실현 손익",
            value: summary.totalRealizedPnl !== 0
              ? fmtPnl(summary.totalRealizedPnl)
              : "—",
            color: summary.totalRealizedPnl >= 0
              ? "text-emerald-400"
              : "text-red-400",
          },
          {
            label: "승률",
            value: summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : "—",
            color: (summary.winRate ?? 0) >= 50 ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "승 / 패",
            value: summary.sellCount > 0
              ? `${summary.winTrades}W · ${summary.lossTrades}L`
              : "—",
            color: "text-white",
          },
          {
            label: "Core / Satellite",
            value: `${categoryBreakdown.core} / ${categoryBreakdown.satellite}`,
            color: "text-zinc-300",
          },
        ].map((card) => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1.5">{card.label}</div>
            <div className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── 감정별 수익률 차트 ──────────────────────────────────────────────── */}
      {chartData.length > 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">감정별 평균 수익률</h3>
            <span className="text-xs text-zinc-600">SELL 거래 기준 · FIFO 매칭</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="tag"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                tick={{ fill: "#52525b", fontSize: 11 }}
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
                      ? (emotionColors[entry.tag] ?? "#10b981")
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">감정 태그 분석</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {emotionStats.map((stat) => (
              <div
                key={stat.tag}
                className="flex items-start gap-3 bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-4"
              >
                <span
                  className={`shrink-0 inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border ${emotionBgStyles[stat.tag] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}
                >
                  {stat.tag}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">총 거래</span>
                    <span className="text-zinc-200 font-medium">{stat.count}건</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">매수 / 매도</span>
                    <span className="text-zinc-200">{stat.buyCount} / {stat.sellCount}</span>
                  </div>
                  {stat.sellCount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">평균 수익률</span>
                        <span
                          className={`font-bold ${(stat.avgReturnPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {stat.avgReturnPct != null
                            ? `${stat.avgReturnPct >= 0 ? "+" : ""}${stat.avgReturnPct.toFixed(2)}%`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">실현 손익</span>
                        <span
                          className={`font-medium ${stat.totalRealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {fmtPnl(stat.totalRealizedPnl)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">승 / 패</span>
                        <span className="text-zinc-300">
                          <span className="text-emerald-400">{stat.winCount}W</span>
                          <span className="text-zinc-600 mx-1">·</span>
                          <span className="text-red-400">{stat.lossCount}L</span>
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">실현 손익 내역</h3>
            <span className="text-xs text-zinc-600">FIFO 기준 최근 20건</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["날짜", "종목", "수량", "평균 매수가", "매도가", "실현 손익", "수익률", "감정"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-zinc-600 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {realizedTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{t.tradedAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-white font-mono font-semibold">{t.ticker}</span>
                        <span className="text-zinc-600">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 tabular-nums">
                      {t.quantity.toLocaleString("ko-KR")}주
                    </td>
                    <td className="px-4 py-3 text-zinc-400 tabular-nums">
                      ₩{Math.round(t.avgBuyPrice).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 tabular-nums">
                      ₩{t.sellPrice.toLocaleString("ko-KR")}
                    </td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${t.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtPnl(t.realizedPnl)}
                    </td>
                    <td className={`px-4 py-3 font-bold tabular-nums ${t.returnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.returnPct >= 0 ? "+" : ""}{t.returnPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      {t.emotionTag && (
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${emotionBgStyles[t.emotionTag] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-zinc-500 text-sm">SELL 거래 기록 후 실현 손익 분석이 표시됩니다.</p>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
