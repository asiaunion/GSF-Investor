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
  A: "text-[var(--color-brand-green)] bg-emerald-500/10 border-emerald-500/30",
  B: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  C: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  D: "text-red-400 bg-red-500/10 border-red-500/30",
};

const gradeRingColor: Record<string, string> = {
  A: "var(--color-brand-green)",
  B: "#3b82f6",
  C: "var(--color-warn-500)",
  D: "#ef4444",
};

const marketBadge: Record<string, string> = {
  KR: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  US: "bg-emerald-500/10 text-[var(--color-brand-green)] border border-emerald-500/20",
};

// ── Radar Tooltip ─────────────────────────────────────────────────────────────
function RadarTooltip({ active, payload }: { active?: boolean; payload?: { payload: CheckItem; value: number }[] }) {
  if (!active || !payload?.[0]) return null;
  const { payload: item } = payload[0];
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="font-bold text-[var(--color-text-primary)] mb-1">{item.label}</div>
      <div className="text-[var(--color-text-secondary)]">
        점수: <span className="text-emerald-400 font-bold">{item.score}</span>
      </div>
      <div className="text-[var(--color-text-secondary)]">
        실제값: <span className="text-[var(--color-text-primary)]">{item.raw}</span>
      </div>
    </div>
  );
}

// ── Score Bar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score, grade }: { score: number; grade: string }) {
  const color = gradeRingColor[grade] ?? "#71717a";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
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
          <div key={i} className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6 text-sm text-[var(--color-text-muted)]">
        스코어보드를 불러오지 못했습니다: {error}
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-[var(--color-text-muted)] text-sm">관심종목을 먼저 추가하세요.</p>
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
          { label: "전체 종목", value: `${stocks.length}개`, color: "text-[var(--color-text-primary)]" },
          { label: "A등급", value: `${stocks.filter((s) => s.grade === "A").length}개`, color: "text-[var(--color-brand-green)]" },
          { label: "B등급", value: `${stocks.filter((s) => s.grade === "B").length}개`, color: "text-emerald-400" },
          {
            label: "평균 스코어",
            value: stocks.length > 0
              ? `${Math.round(stocks.reduce((s, x) => s + x.totalScore, 0) / stocks.length)}점`
              : "—",
            color: "text-emerald-400",
          },
        ].map((card) => (
          <div key={card.label} className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-4">
            <div className="text-[var(--color-text-disabled)] text-[10px] uppercase tracking-wider mb-1.5">{card.label}</div>
            <div className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── 메인 레이아웃: 레이더 + 랭킹 ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 레이더 차트 (선택된 종목) */}
        <div className="lg:col-span-2 bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{selected.name}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selected.ticker} · {selected.market}</p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${gradeColor[selected.grade] ?? ""}`}>
              {selected.grade}
            </div>
          </div>

          {/* Radar */}
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="var(--color-border-default)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
              />
              <Radar
                name={selected.name}
                dataKey="score"
                stroke={gradeRingColor[selected.grade] ?? "var(--color-brand-green)"}
                fill={gradeRingColor[selected.grade] ?? "var(--color-brand-green)"}
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
                    ? "bg-emerald-500/5 border-emerald-500/20 text-[var(--color-brand-green)]"
                    : c.pass === false
                    ? "bg-red-500/5 border-red-500/20 text-red-400"
                    : "bg-[var(--color-bg-elevated)]/50 border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
                }`}
              >
                <span>{c.label}</span>
                <span className="font-mono font-bold">{c.raw}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 랭킹 테이블 */}
        <div className="lg:col-span-3 bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm">
          <div className="px-5 py-4 border-b border-[var(--color-border-default)] flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0">종목 스코어 순위</h3>
            {/* 등급 필터 */}
            <div className="flex gap-1.5 flex-wrap">
              {grades.map((g) => (
                <button
                  key={g}
                  id={`btn-filter-grade-${g}`}
                  onClick={() => setFilterGrade(g)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    filterGrade === g
                      ? "text-white"
                      : "bg-[var(--color-bg-elevated)] border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
                  selectedId === stock.stockId ? "bg-[var(--color-bg-elevated)]/60" : "hover:bg-[var(--color-bg-elevated)]/30"
                }`}
                onClick={() => setSelectedId(stock.stockId)}
              >
                {/* 순위 */}
                <div className="shrink-0 w-6 text-center text-xs font-bold text-[var(--color-text-disabled)]">
                  {i + 1}
                </div>

                {/* 종목 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{stock.name}</span>
                    <span className="text-xs text-[var(--color-text-disabled)] font-mono">{stock.ticker}</span>
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
                  className="shrink-0 text-xs text-[var(--color-text-disabled)] hover:text-emerald-400 transition-colors"
                >
                  →
                </Link>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-[var(--color-text-disabled)] text-sm">
              해당 등급의 종목이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* ── AI 패턴 요약 ─────────────────────────────────────────────────────── */}
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <span className="text-emerald-400">✦</span> AI 패턴 요약
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* 최고 스코어 */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="text-[var(--color-brand-green)] font-semibold mb-1">🏆 최고 점수 종목</div>
            <div className="text-[var(--color-text-primary)] font-bold">{stocks[0]?.name ?? "—"}</div>
            <div className="text-[var(--color-text-muted)] mt-0.5">
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
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <div className="text-emerald-400 font-semibold mb-1">💎 최저 PBR</div>
                <div className="text-[var(--color-text-primary)] font-bold">{top?.name ?? "데이터 없음"}</div>
                <div className="text-[var(--color-text-muted)] mt-0.5">
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
                <div className="text-[var(--color-text-primary)] font-bold">{top?.name ?? "데이터 없음"}</div>
                <div className="text-[var(--color-text-muted)] mt-0.5">
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
