"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

// Recharts — SSR 방지
const RadarChart = dynamic(() => import("recharts").then((m) => m.RadarChart), { ssr: false });
const Radar = dynamic(() => import("recharts").then((m) => m.Radar), { ssr: false });
const PolarGrid = dynamic(() => import("recharts").then((m) => m.PolarGrid), { ssr: false });
const PolarAngleAxis = dynamic(() => import("recharts").then((m) => m.PolarAngleAxis), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface CheckItem {
  label: string;
  score: number;
  raw: string;
  pass: boolean | null;
}

interface StockScore {
  stockId: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  latestPrice: number | null;
  totalScore: number;
  grade: string;
  passCount: number;
  checks: CheckItem[];
  pbr: number | null;
  per: number | null;
  debtRatio: number | null;
}

// ── Color utilities ────────────────────────────────────────────────────────────
const gradeColor: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  B: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  C: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  D: "text-red-400 bg-red-500/10 border-red-500/30",
};

const gradeRingColor: Record<string, string> = {
  A: "#10b981",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#ef4444",
};

const marketBadge: Record<string, string> = {
  KR: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  US: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

// ── Radar Tooltip ─────────────────────────────────────────────────────────────
function RadarTooltip({ active, payload }: { active?: boolean; payload?: { payload: CheckItem; value: number }[] }) {
  if (!active || !payload?.[0]) return null;
  const { payload: item } = payload[0];
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="font-bold text-white mb-1">{item.label}</div>
      <div className="text-zinc-400">
        점수: <span className="text-violet-400 font-bold">{item.score}</span>
      </div>
      <div className="text-zinc-400">
        실제값: <span className="text-zinc-200">{item.raw}</span>
      </div>
    </div>
  );
}

// ── Score Bar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score, grade }: { score: number; grade: string }) {
  const color = gradeRingColor[grade] ?? "#71717a";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function DiscoverScoreboard() {
  const [stocks, setStocks] = useState<StockScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/discover/all-scores")
      .then((r) => {
        if (!r.ok) throw new Error("API 오류");
        return r.json();
      })
      .then((d) => {
        setStocks(d.stocks ?? []);
        if (d.stocks?.length > 0) setSelectedId(d.stocks[0].stockId);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-500">
        스코어보드를 불러오지 못했습니다: {error}
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-zinc-500 text-sm">관심종목을 먼저 추가하세요.</p>
      </div>
    );
  }

  const grades = ["ALL", "A", "B", "C", "D"];
  const filtered = filterGrade === "ALL" ? stocks : stocks.filter((s) => s.grade === filterGrade);
  const selected = stocks.find((s) => s.stockId === selectedId) ?? stocks[0];
  const radarData = selected.checks.map(({ score, label, raw, pass }) => ({ subject: label, score, fullMark: 100, label, raw, pass }));

  return (
    <div className="space-y-5">
      {/* ── 헤더 통계 ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "전체 종목", value: `${stocks.length}개`, color: "text-white" },
          { label: "A등급", value: `${stocks.filter((s) => s.grade === "A").length}개`, color: "text-emerald-400" },
          { label: "B등급", value: `${stocks.filter((s) => s.grade === "B").length}개`, color: "text-blue-400" },
          {
            label: "평균 스코어",
            value: stocks.length > 0
              ? `${Math.round(stocks.reduce((s, x) => s + x.totalScore, 0) / stocks.length)}점`
              : "—",
            color: "text-violet-400",
          },
        ].map((card) => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-600 text-[10px] uppercase tracking-wider mb-1.5">{card.label}</div>
            <div className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── 메인 레이아웃: 레이더 + 랭킹 ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 레이더 차트 (선택된 종목) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{selected.name}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{selected.ticker} · {selected.market}</p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${gradeColor[selected.grade] ?? ""}`}>
              {selected.grade}
            </div>
          </div>

          {/* Radar */}
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#71717a", fontSize: 11 }}
              />
              <Radar
                name={selected.name}
                dataKey="score"
                stroke={gradeRingColor[selected.grade] ?? "#8b5cf6"}
                fill={gradeRingColor[selected.grade] ?? "#8b5cf6"}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>

          {/* 지표 상세 */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {selected.checks.map((c) => (
              <div
                key={c.label}
                className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${
                  c.pass === true
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                    : c.pass === false
                    ? "bg-red-500/5 border-red-500/20 text-red-400"
                    : "bg-zinc-800/50 border-zinc-700 text-zinc-500"
                }`}
              >
                <span>{c.label}</span>
                <span className="font-mono font-bold">{c.raw}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 랭킹 테이블 */}
        <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white shrink-0">종목 스코어 순위</h3>
            {/* 등급 필터 */}
            <div className="flex gap-1.5 flex-wrap">
              {grades.map((g) => (
                <button
                  key={g}
                  id={`btn-filter-grade-${g}`}
                  onClick={() => setFilterGrade(g)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    filterGrade === g
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-zinc-800/50">
            {filtered.map((stock, i) => (
              <div
                key={stock.stockId}
                className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors ${
                  selectedId === stock.stockId ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"
                }`}
                onClick={() => setSelectedId(stock.stockId)}
              >
                {/* 순위 */}
                <div className="shrink-0 w-6 text-center text-xs font-bold text-zinc-600">
                  {i + 1}
                </div>

                {/* 종목 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{stock.name}</span>
                    <span className="text-xs text-zinc-600 font-mono">{stock.ticker}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${marketBadge[stock.market] ?? ""}`}>
                      {stock.market}
                    </span>
                  </div>
                  {/* 점수 바 */}
                  <div className="mt-1.5">
                    <ScoreBar score={stock.totalScore} grade={stock.grade} />
                  </div>
                </div>

                {/* 등급 배지 */}
                <div className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${gradeColor[stock.grade] ?? ""}`}>
                  {stock.grade}
                </div>

                {/* 종목 상세 링크 */}
                <Link
                  href={`/stocks/${stock.ticker}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-xs text-zinc-600 hover:text-violet-400 transition-colors"
                >
                  →
                </Link>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-zinc-600 text-sm">
              해당 등급의 종목이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* ── AI 패턴 요약 ─────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-violet-400">✦</span> AI 패턴 요약
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* 최고 스코어 */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="text-emerald-400 font-semibold mb-1">🏆 최고 점수 종목</div>
            <div className="text-white font-bold">{stocks[0]?.name ?? "—"}</div>
            <div className="text-zinc-500 mt-0.5">
              {stocks[0] ? `${stocks[0].totalScore}점 · Grade ${stocks[0].grade}` : ""}
            </div>
          </div>

          {/* 가장 저평가 (PBR 기준) */}
          {(() => {
            const byPbr = [...stocks]
              .filter((s) => s.pbr != null)
              .sort((a, b) => (a.pbr ?? 99) - (b.pbr ?? 99));
            const top = byPbr[0];
            return (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <div className="text-blue-400 font-semibold mb-1">💎 최저 PBR</div>
                <div className="text-white font-bold">{top?.name ?? "데이터 없음"}</div>
                <div className="text-zinc-500 mt-0.5">
                  {top?.pbr != null ? `PBR ${top.pbr.toFixed(2)}x` : "N/A"}
                </div>
              </div>
            );
          })()}

          {/* 가장 저PER */}
          {(() => {
            const byPer = [...stocks]
              .filter((s) => s.per != null && (s.per as number) > 0)
              .sort((a, b) => (a.per ?? 999) - (b.per ?? 999));
            const top = byPer[0];
            return (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <div className="text-amber-400 font-semibold mb-1">📈 최저 PER</div>
                <div className="text-white font-bold">{top?.name ?? "데이터 없음"}</div>
                <div className="text-zinc-500 mt-0.5">
                  {top?.per != null ? `PER ${top.per.toFixed(1)}x` : "N/A"}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
