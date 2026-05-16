"use client";

import Link from "next/link";
import type { ReportDetail } from "./page";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type ChartsData = {
  prices: { date: string; close: number }[];
  financials: {
    period: string;
    revenue: number | null;
    opIncome: number | null;
    netIncome: number | null;
  }[];
};

const triggerLabel: Record<string, string> = {
  MANUAL: "수동 생성",
  SIGNAL_AUTO: "시그널 자동",
};

function formatMd(md: string): string {
  return md;
}

export default function ReportDetailClient({ report }: { report: ReportDetail }) {
  let chartsData: ChartsData | null = null;
  try {
    if (report.chartsJson) {
      chartsData = JSON.parse(report.chartsJson);
    }
  } catch {
    chartsData = null;
  }

  const priceData = chartsData?.prices?.slice(-30) ?? [];
  const finData = (chartsData?.financials ?? []).map((f) => ({
    period: f.period,
    매출: f.revenue != null ? Math.round(f.revenue / 1e8) : null,
    영업이익: f.opIncome != null ? Math.round(f.opIncome / 1e8) : null,
    순이익: f.netIncome != null ? Math.round(f.netIncome / 1e8) : null,
  }));

  // 마크다운 → 간단 HTML 변환 (highlight 섹션)
  const sections = report.contentMd.split(/^## /m).filter(Boolean);
  const titleMatch = report.contentMd.match(/^# (.+)$/m);
  const reportTitle = titleMatch ? titleMatch[1] : `${report.stockName} 분석 보고서`;

  return (
    <div className="space-y-6">
      {/* ── 헤더 ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/reports"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-3 inline-flex items-center gap-1"
          >
            ← 보고서 목록
          </Link>
          <h1 className="text-xl font-bold text-white mt-1">{reportTitle}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-sm text-zinc-400">
              {new Date(report.generatedAt).toLocaleString("ko-KR")}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              report.trigger === "SIGNAL_AUTO"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
            }`}>
              {triggerLabel[report.trigger] ?? report.trigger}
            </span>
            <Link
              href={`/stocks/${report.ticker}`}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              {report.ticker} 종목 상세 →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 차트 (가격 + 재무) ──────────────────────────────────────────── */}
      {chartsData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 주가 차트 */}
          {priceData.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">주가 추이 (최근 30일)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={priceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickFormatter={(v) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickFormatter={(v) => v.toLocaleString()}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    formatter={(v) => [v != null ? Number(v).toLocaleString() : "N/A", "종가"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 재무 차트 */}
          {finData.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">재무 추이 (억원)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={finData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="period" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => `${v}`} width={45} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                    formatter={(v) => [v != null ? `${Number(v)}억` : "N/A"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
                  <Bar dataKey="매출" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="영업이익" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="순이익" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── AI 보고서 본문 ───────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="prose prose-invert prose-sm max-w-none">
          <pre
            className="text-sm text-zinc-200 whitespace-pre-wrap leading-7"
            style={{ fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}
          >
            {report.contentMd}
          </pre>
        </div>
      </div>
    </div>
  );
}
