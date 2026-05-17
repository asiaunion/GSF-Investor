"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import dynamic from "next/dynamic";
import type { ReportDetail } from "./page";
import type { FactCheckResult } from "@/lib/gemini";

// recharts — SSR 비활성화 (recharts는 window 객체 사용)
const LineChart   = dynamic(() => import("recharts").then((m) => m.LineChart),         { ssr: false });
const Line        = dynamic(() => import("recharts").then((m) => m.Line),              { ssr: false });
const XAxis       = dynamic(() => import("recharts").then((m) => m.XAxis),             { ssr: false });
const YAxis       = dynamic(() => import("recharts").then((m) => m.YAxis),             { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid),   { ssr: false });
const Tooltip     = dynamic(() => import("recharts").then((m) => m.Tooltip),           { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const BarChart    = dynamic(() => import("recharts").then((m) => m.BarChart),          { ssr: false });
const Bar         = dynamic(() => import("recharts").then((m) => m.Bar),               { ssr: false });
const Legend      = dynamic(() => import("recharts").then((m) => m.Legend),            { ssr: false });


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

// ── react-markdown 커스텀 컴포넌트 맵 ──────────────────────────────────────────
const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-[var(--color-text-primary)] mt-8 mb-4 leading-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-emerald-300 mt-7 mb-3 pb-2 border-b border-[var(--color-border-default)] flex items-center gap-2">
      <span className="w-1 h-4 bg-emerald-500 rounded-full inline-block shrink-0" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-5 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mt-3 mb-1">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm text-[var(--color-text-primary)] leading-7 my-2">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-[var(--color-text-primary)] font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-[var(--color-text-primary)] italic">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="my-3 space-y-1.5 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 space-y-1.5 list-decimal list-inside pl-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-[var(--color-text-primary)] leading-relaxed flex gap-2 items-start">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
      <span>{children}</span>
    </li>
  ),
  hr: () => <hr className="border-[var(--color-border-default)] my-6" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 border-l-2 border-emerald-500/40 text-[var(--color-text-secondary)] text-sm italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    return isBlock ? (
      <code className="block bg-[var(--color-bg-elevated)]/60 border border-[var(--color-border-strong)]/50 rounded-lg px-4 py-3 text-xs text-emerald-300 font-mono whitespace-pre-wrap my-3 overflow-x-auto">
        {children}
      </code>
    ) : (
      <code className="bg-[var(--color-bg-elevated)] rounded px-1.5 py-0.5 text-xs text-emerald-300 font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-[var(--color-border-default)]">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--color-bg-elevated)]/60">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-[var(--color-text-secondary)] font-semibold border-b border-[var(--color-border-strong)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-[var(--color-text-primary)] border-b border-[var(--color-border-default)]/50">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-[var(--color-bg-elevated)]/20 transition-colors">{children}</tr>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
};

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={mdComponents}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── C-3: 팩트체크 패널 ────────────────────────────────────────────────────────
function FactCheckPanel({ result }: { result: FactCheckResult }) {
  const scoreColor =
    result.errors > 0
      ? "text-red-400 border-red-500/30 bg-red-500/10"
      : result.warnings > 0
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-[var(--color-brand-green)] border-emerald-500/30 bg-emerald-500/10";

  const scoreLabel =
    result.errors > 0 ? "오류" : result.warnings > 0 ? "주의" : "검증됨";

  if (result.totalChecked === 0) return null;

  return (
    <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">🔍 데이터 검증 패널</span>
          <span className="text-xs text-[var(--color-text-muted)]">AI 보고서 수치 교차검증</span>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${scoreColor}`}>
          {scoreLabel} · {result.verified}/{result.totalChecked}
        </span>
      </div>

      {/* 항목별 검증 결과 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {result.items.map((item, i) => {
          const isVerified = item.status === "verified";
          return (
            <div
              key={i}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                isVerified
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-amber-500/20 bg-amber-500/5"
              }`}
            >
              <span className={`mt-0.5 text-sm shrink-0 ${
                isVerified ? "text-[var(--color-brand-green)]" : "text-amber-400"
              }`}>
                {isVerified ? "✓" : "!"}
              </span>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">{item.label}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.note}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-text-disabled)] mt-3">
        검증 기준: DB 재무수치 ±5% 허용범위 · {new Date(result.checkedAt).toLocaleString("ko-KR")}
      </p>
    </div>
  );
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

  const titleMatch = report.contentMd.match(/^# (.+)$/m);
  const reportTitle = titleMatch ? titleMatch[1] : `${report.stockName} 분석 보고서`;

  return (
    <div className="space-y-6">
      {/* ── 헤더 ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/reports"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-3 inline-flex items-center gap-1"
          >
            ← 보고서 목록
          </Link>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mt-1">{reportTitle}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {new Date(report.generatedAt + "Z").toLocaleString("ko-KR", {
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit",
                hour12: false
              })}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              report.trigger === "SIGNAL_AUTO"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}>
              {triggerLabel[report.trigger] ?? report.trigger}
            </span>
            <Link
              href={`/stocks/${report.ticker}`}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {report.ticker} 종목 상세 →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 차트 (가격 + 재무) ──────────────────────────────────────────── */}
      {chartsData && (priceData.length > 0 || finData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 주가 차트 */}
          {priceData.length > 0 && (
            <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">주가 추이 (최근 30일)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={priceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
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
                    contentStyle={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-strong)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--color-text-secondary)" }}
                    formatter={(v) => [v != null ? Number(v).toLocaleString() : "N/A", "종가"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="var(--color-brand-green)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 재무 차트 */}
          {finData.length > 0 && (
            <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">재무 추이 (억원)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={finData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" />
                  <XAxis dataKey="period" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => `${v}`} width={45} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-strong)", borderRadius: 8 }}
                    formatter={(v) => [v != null ? `${Number(v)}억` : "N/A"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-secondary)" }} />
                  <Bar dataKey="매출" fill="var(--color-brand-blue)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="영업이익" fill="var(--color-brand-green)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="순이익" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── C-3: 팩트체크 패널 ───────────────────────────────────────── */}
      {report.factCheck && report.factCheck.totalChecked > 0 && (
        <FactCheckPanel result={report.factCheck} />
      )}

      {/* ── AI 보고서 본문 (마크다운 렌더링) ──────────────────────────── */}
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6">
        <div className="max-w-none">
          <MarkdownRenderer content={report.contentMd} />
        </div>
      </div>
    </div>
  );
}
