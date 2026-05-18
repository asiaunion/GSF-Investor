"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then((m) => m.ReferenceLine), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const Dot = dynamic(() => import("recharts").then((m) => m.Dot), { ssr: false });

interface TrendPoint {
  date: string;
  avgScore: number;
  count: number;
  ticker: string | null;
  emotionTag: string | null;
}

interface RawEntry {
  id: number;
  ticker: string | null;
  name: string | null;
  tradedAt: string;
  action: string;
  confidenceScore: number | null;
  emotionTag: string | null;
}

const emotionColors: Record<string, string> = {
  확신: "var(--color-brand-green)",
  계획적: "#3b82f6",
  불안: "var(--color-warn-500)",
  충동: "#ef4444",
};

function scoreLabel(score: number) {
  if (score >= 4.5) return "매우 높음";
  if (score >= 3.5) return "높음";
  if (score >= 2.5) return "보통";
  if (score >= 1.5) return "낮음";
  return "매우 낮음";
}

function scoreDotColor(score: number) {
  if (score >= 4) return "var(--color-brand-green)";
  if (score >= 3) return "#3b82f6";
  if (score >= 2) return "var(--color-warn-500)";
  return "#ef4444";
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-xl px-4 py-3 text-xs shadow-xl min-w-[140px]">
      <div className="text-[var(--color-text-secondary)] mb-1">{p.date}</div>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ background: scoreDotColor(p.avgScore) }}
        />
        <span className="text-[var(--color-text-primary)] font-bold text-sm">
          {p.avgScore.toFixed(1)}점
        </span>
        <span className="text-[var(--color-text-muted)]">/ 5</span>
      </div>
      <div className="text-[var(--color-text-muted)]">{scoreLabel(p.avgScore)}</div>
      {p.ticker && (
        <div className="mt-1 text-[var(--color-text-secondary)]">
          종목: <span className="text-[var(--color-text-primary)] font-mono">{p.ticker}</span>
        </div>
      )}
      {p.emotionTag && (
        <div className="mt-0.5 text-[var(--color-text-secondary)]">
          감정:{" "}
          <span style={{ color: emotionColors[p.emotionTag] ?? "#71717a" }}>
            {p.emotionTag}
          </span>
        </div>
      )}
      {p.count > 1 && (
        <div className="mt-0.5 text-[var(--color-text-disabled)]">{p.count}건 평균</div>
      )}
    </div>
  );
}

// Score pill
function ScorePill({ score }: { score: number }) {
  const filled = Math.round(score);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-4 rounded-full transition-all ${
            i <= filled ? "opacity-100" : "opacity-20"
          }`}
          style={{ background: scoreDotColor(score) }}
        />
      ))}
    </div>
  );
}

export default function ConfidenceTrend() {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [raw, setRaw] = useState<RawEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/journal/confidence")
      .then((r) => {
        if (!r.ok) throw new Error("API 오류");
        return r.json();
      })
      .then((data) => {
        setTrend(data.trend ?? []);
        setRaw(data.raw ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6 animate-pulse h-56" />
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6 text-[var(--color-text-muted)] text-sm">
        확신도 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  // 아직 데이터 없음
  if (trend.length === 0) {
    return (
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-8 text-center">
        <div className="text-3xl mb-3">🎯</div>
        <p className="text-[var(--color-text-muted)] text-sm">
          매매 일지 저장 시 확신도를 입력하면 추이 차트가 표시됩니다.
        </p>
        <p className="text-[var(--color-text-disabled)] text-xs mt-1">
          별점 1~5점으로 해당 거래의 확신도를 기록하세요.
        </p>
      </div>
    );
  }

  // 현재 평균 확신도
  const latestScore = trend[trend.length - 1]?.avgScore ?? 0;
  const overallAvg = raw.reduce((s, r) => s + (r.confidenceScore ?? 0), 0) / raw.length;

  // 그래프용 커스텀 도트
  interface DotProps {
    cx?: number;
    cy?: number;
    payload?: TrendPoint;
  }
  
  function CustomDot({ cx, cy, payload }: DotProps) {
    if (cx === undefined || cy === undefined || !payload) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={scoreDotColor(payload.avgScore)}
        stroke="var(--color-bg-surface)"
        strokeWidth={2}
      />
    );
  }

  return (
    <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5 space-y-5">
      {/* 헤더 + 요약 */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">확신도 추이</h3>
          <p className="text-xs text-[var(--color-text-disabled)] mt-0.5">거래별 확신도 1~5점 시계열</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[10px] text-[var(--color-text-disabled)] mb-0.5">최근 확신도</div>
            <div className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
              {latestScore.toFixed(1)}
              <span className="text-xs text-[var(--color-text-muted)] font-normal ml-0.5">/5</span>
            </div>
            <ScorePill score={latestScore} />
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[var(--color-text-disabled)] mb-0.5">전체 평균</div>
            <div className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
              {overallAvg.toFixed(1)}
              <span className="text-xs text-[var(--color-text-muted)] font-normal ml-0.5">/5</span>
            </div>
            <ScorePill score={overallAvg} />
          </div>
        </div>
      </div>

      {/* 라인 차트 */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={trend}
          margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD만 표시
          />
          <YAxis
            domain={[0, 5.2]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* 기준선 3점 */}
          <ReferenceLine
            y={3}
            stroke="var(--color-border-strong)"
            strokeDasharray="4 4"
            label={{ value: "기준", fill: "var(--color-text-secondary)", fontSize: 9, position: "right" }}
          />
          <Line
            type="monotone"
            dataKey="avgScore"
            stroke="var(--color-brand-green)"
            strokeWidth={2.5}
            dot={<CustomDot />}
            activeDot={{ r: 7, fill: "var(--color-brand-green)", stroke: "var(--color-bg-surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* 최근 기록 리스트 */}
      {raw.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--color-text-disabled)] uppercase tracking-wider mb-2">
            최근 확신도 기록
          </div>
          <div className="space-y-1.5">
            {[...raw].reverse().slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 text-xs py-1.5 border-b border-[var(--color-border-default)]/50 last:border-0"
              >
                <span className="text-[var(--color-text-disabled)] w-20 shrink-0 tabular-nums">
                  {entry.tradedAt.slice(0, 10)}
                </span>
                <span className="text-[var(--color-text-secondary)] font-mono w-16 shrink-0">
                  {entry.ticker ?? "—"}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    entry.action === "BUY"
                      ? "bg-brand-green/10 text-[var(--color-brand-green)]"
                      : "bg-loss-bg text-loss-400"
                  }`}
                >
                  {entry.action}
                </span>
                <div className="flex-1 flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`w-3 h-1 rounded-full ${
                          i <= (entry.confidenceScore ?? 0)
                            ? "opacity-100"
                            : "opacity-15"
                        }`}
                        style={{
                          background: scoreDotColor(entry.confidenceScore ?? 0),
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[var(--color-text-secondary)] font-bold">
                    {entry.confidenceScore}점
                  </span>
                </div>
                {entry.emotionTag && (
                  <span
                    className="shrink-0 text-[10px] font-medium"
                    style={{
                      color: emotionColors[entry.emotionTag] ?? "#71717a",
                    }}
                  >
                    {entry.emotionTag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
