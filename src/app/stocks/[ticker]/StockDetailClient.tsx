"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PnlMethodHint } from "@/components/PnlMethodHint";
import {
  btnPrimarySm,
  economistCard,
  linkMuted,
  marketBadge,
  pnlTextClass,
  severityConfig,
  tabActive,
  tabInactive,
  textareaClass,
} from "@/lib/economist-ui";

const PriceAreaChart = dynamic(
  () => import("@/components/StockCharts").then((m) => m.PriceAreaChart),
  { ssr: false }
);
const IncomeLineChart = dynamic(
  () => import("@/components/StockCharts").then((m) => m.IncomeLineChart),
  { ssr: false }
);
const BalanceSheetBarChart = dynamic(
  () => import("@/components/StockCharts").then((m) => m.BalanceSheetBarChart),
  { ssr: false }
);
// ── Types ────────────────────────────────────────────────────────────────────
interface Stock {
  id: number; ticker: string; name: string; market: string;
  category: string; broker: string | null; thesis: string | null;
}
interface Overview {
  currentPrice: number | null; priceDate: string | null;
  currency: string; per: number | null; pbr: number | null;
  dividendYield: number | null; roe: number | null; metricsPeriod: string | null;
  holdingReturn: number | null;
  portfolio: { quantity: number; avgPrice: number } | null;
  usdkrw: number;
}
interface Financial {
  period: string; revenue: number | null; opIncome: number | null;
  netIncome: number | null; totalAssets: number | null;
  totalEquity: number | null; cashAndEquivalents: number | null;
  debtRatio: number | null; eps: number | null; bps: number | null;
  roe: number | null; dividendPerShare: number | null; operCashFlow: number | null; source: string;
}
interface Disclosure {
  id: number; source: string; filedAt: string; title: string;
  summaryAi: string | null; rawUrl: string | null; rcpNo: string | null;
}
interface Signal {
  id: number; detectedAt: string; type: string; severity: string;
  description: string; isResolved: number; resolvedNote: string | null;
}
interface Note {
  id: number; contentMd: string; createdAt: string; updatedAt: string;
}
interface PricePoint { date: string; price: number; }

interface Props {
  stock: Stock;
  overview: Overview;
  priceChart: PricePoint[];
  quarterlyFinancials: Financial[];
  annualFinancials: Financial[];
  disclosures: Disclosure[];
  signals: Signal[];
  notes: Note[];
}

const TABS = ["Overview", "재무", "공시", "시그널", "메모"] as const;
type Tab = typeof TABS[number];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number | null, digits = 2) {
  return v != null ? v.toFixed(digits) : "—";
}
function fmtPrice(v: number | null, currency: string) {
  if (v == null) return "—";
  return currency === "USD"
    ? `$${v.toFixed(2)}`
    : `₩${v.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
}
function fmtLarge(v: number | null, currency: string) {
  if (v == null) return "—";
  if (currency === "USD") {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
  }
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}조`;
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  return `${(v / 1e4).toFixed(0)}만`;
}

function ReturnBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-text-muted">—</span>;
  const pos = value >= 0;
  return (
    <span className={`font-semibold ${pnlTextClass(value)}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const cfg = severityConfig[severity as keyof typeof severityConfig];
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg?.dot ?? "bg-text-muted"}`}
      aria-label={severity}
    />
  );
}

// ── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ overview, stock, priceChart }: { overview: Overview; stock: Stock; priceChart: PricePoint[] }) {
  const { currentPrice, currency, per, pbr, dividendYield, roe, metricsPeriod, holdingReturn, portfolio, usdkrw } = overview;

  return (
    <div className="space-y-6">
      {/* Price hero */}
      <div className={`${economistCard} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-text-muted text-xs mb-1">현재가 · {overview.priceDate ?? "—"}</div>
            <div className="text-3xl font-bold text-text-primary tracking-tight">
              {fmtPrice(currentPrice, currency)}
            </div>
            {currency === "USD" && currentPrice && (
              <div className="text-text-muted text-sm mt-1">
                ≈ ₩{(currentPrice * usdkrw).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
          {portfolio && (
            <div className="text-right">
              <div className="text-text-muted text-xs mb-1 flex items-center justify-end gap-1">
                보유 수익률 <PnlMethodHint method="weighted_avg" />
              </div>
              <div className="text-xl font-bold"><ReturnBadge value={holdingReturn} /></div>
              <div className="text-text-muted text-xs mt-1">
                {portfolio.quantity.toLocaleString()}주 · 평균 {fmtPrice(portfolio.avgPrice, currency)}
              </div>
            </div>
          )}
        </div>

        {/* 주가 차트 */}
        <div className="mt-4">
          <PriceAreaChart data={priceChart} currency={currency} />
        </div>
      </div>

      {/* Valuation metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "PER", value: per != null ? `${per.toFixed(1)}x` : "—" },
          { label: "PBR", value: pbr != null ? `${pbr.toFixed(2)}x` : "—" },
          { label: "배당수익률", value: dividendYield != null ? `${dividendYield.toFixed(2)}%` : "—" },
          { label: "ROE", value: roe != null ? `${roe.toFixed(2)}%` : "—" },
        ].map((m) => (
          <div key={m.label} className={`${economistCard} p-4`}>
            <div className="text-text-muted text-[10px] uppercase tracking-wider">{m.label}</div>
            <div className="text-text-primary text-lg font-semibold mt-1">{m.value}</div>
            {metricsPeriod && (
              <div className="text-text-disabled text-[10px] mt-1">{metricsPeriod} 기준</div>
            )}
          </div>
        ))}
      </div>

      {/* Thesis */}
      {stock.thesis && (
        <div className={`${economistCard} p-5`}>
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">투자 테제</div>
          <p className="text-text-secondary text-sm leading-relaxed">{stock.thesis}</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: 재무 ────────────────────────────────────────────────────────────────
function FinancialTable({ title, rows, currency }: { title: string; rows: Financial[]; currency: string }) {
  if (rows.length === 0) return null;
  return (
    <div className={`${economistCard} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-border-default text-text-secondary text-sm font-medium">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-default">
              <th className="px-4 py-3 text-left text-text-muted font-medium">기간</th>
              <th className="px-4 py-3 text-right text-text-muted font-medium">매출</th>
              <th className="px-4 py-3 text-right text-text-muted font-medium">영업이익</th>
              <th className="px-4 py-3 text-right text-text-muted font-medium">순이익</th>
              <th className="px-4 py-3 text-right text-text-muted font-medium">ROE</th>
              <th className="px-4 py-3 text-right text-text-muted font-medium">EPS</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((f) => (
              <tr key={f.period} className="border-b border-border-default/50 hover:bg-bg-elevated/30 transition-colors">
                <td className="px-4 py-3 text-text-secondary font-medium">{f.period}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{fmtLarge(f.revenue, currency)}</td>
                <td className={`px-4 py-3 text-right font-medium ${f.opIncome != null && f.opIncome >= 0 ? "text-profit-400" : "text-loss-400"}`}>
                  {fmtLarge(f.opIncome, currency)}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${f.netIncome != null && f.netIncome >= 0 ? "text-profit-400" : "text-loss-400"}`}>
                  {fmtLarge(f.netIncome, currency)}
                </td>
                <td className="px-4 py-3 text-right text-text-secondary">{fmt(f.roe)}%</td>
                <td className="px-4 py-3 text-right text-text-secondary">{fmtPrice(f.eps, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinancialTab({ quarterlyFinancials, annualFinancials, currency }: { quarterlyFinancials: Financial[]; annualFinancials: Financial[]; currency: string }) {
  return (
    <div className="space-y-6">
      <div className={`${economistCard} p-5`}>
        <div className="text-text-secondary text-sm font-medium mb-4">손익계산서 추이 (연간)</div>
        <IncomeLineChart data={annualFinancials} currency={currency} />
      </div>
      <div className={`${economistCard} p-5`}>
        <div className="text-text-secondary text-sm font-medium mb-4">재무상태표 (연간)</div>
        <BalanceSheetBarChart data={annualFinancials} currency={currency} />
      </div>
      <FinancialTable title="연간 실적" rows={annualFinancials} currency={currency} />
      <FinancialTable title="분기 실적" rows={quarterlyFinancials} currency={currency} />
    </div>
  );
}

// ── Tab: 공시 ────────────────────────────────────────────────────────────────
function DisclosuresTab({ disclosures }: { disclosures: Disclosure[] }) {
  if (disclosures.length === 0)
    return <EmptyState label="공시 데이터 없음" sub="daily_dart.py / daily_sec.py 실행 후 표시됩니다" />;

  return (
    <div className="space-y-3">
      {disclosures.map((d) => (
        <div key={d.id} className={`${economistCard} p-4 hover:border-border-strong transition-colors`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm border ${
              d.source === "DART" ? marketBadge.KR : "bg-warn-bg text-warn-400 border-warn-border"
            }`}>{d.source}</span>
            <span className="text-text-muted text-xs">{d.filedAt.slice(0, 10)}</span>
          </div>
          <div className="text-text-primary text-sm font-medium leading-snug">{d.title}</div>
          {d.summaryAi && (
            <div className="mt-2 text-text-muted text-xs leading-relaxed line-clamp-3">
              {d.summaryAi}
            </div>
          )}
          {d.rawUrl && (
            <a
              href={d.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 mt-2 text-xs ${linkMuted}`}
            >
              원문 보기 →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: 시그널 ──────────────────────────────────────────────────────────────
function SignalsTab({ signals }: { signals: Signal[] }) {
  if (signals.length === 0)
    return <EmptyState label="시그널 없음" sub="weekly_signal.py 실행 후 표시됩니다" />;

  return (
    <div className="space-y-3">
      {signals.map((s) => (
        <div key={s.id} className={`${economistCard} p-4 transition-colors ${s.isResolved ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <SeverityDot severity={s.severity} />
              <span className="text-text-secondary text-xs font-medium">{s.type.replace(/_/g, " ")}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${severityConfig[s.severity as keyof typeof severityConfig]?.badge ?? ""}`}>
                {s.severity}
              </span>
            </div>
            <span className="text-text-muted text-xs">{s.detectedAt.slice(0, 10)}</span>
          </div>
          <div className="text-text-secondary text-sm leading-relaxed">{s.description}</div>
          {s.resolvedNote && (
            <div className="mt-2 text-text-muted text-xs">✓ {s.resolvedNote}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: 메모 ────────────────────────────────────────────────────────────────
function NotesTab({ notes, ticker, onAdded }: { notes: Note[]; ticker: string; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/${ticker}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentMd: text }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "저장 실패");
      } else {
        setText("");
        onAdded();
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Input form */}
      <form onSubmit={handleSubmit} className={`${economistCard} p-4`}>
        <div className="text-text-secondary text-xs font-medium mb-2">새 메모 작성</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="투자 메모를 작성하세요 (마크다운 지원)..."
          rows={4}
          className={textareaClass}
        />
        {error && <p className="text-loss-400 text-xs mt-1">{error}</p>}
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className={btnPrimarySm}
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState label="메모 없음" sub="첫 번째 투자 메모를 작성해보세요" />
      ) : (
        notes.map((note) => (
          <div key={note.id} className={`${economistCard} p-4`}>
            <div className="text-text-muted text-[10px] mb-2">{note.createdAt.slice(0, 16)}</div>
            <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">{note.contentMd}</div>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <div className={`w-12 h-12 rounded-sm ${economistCard} flex items-center justify-center`}>
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="text-text-muted text-sm">{label}</p>
      {sub && <p className="text-text-disabled text-xs">{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StockDetailClient({
  stock,
  overview,
  priceChart,
  quarterlyFinancials,
  annualFinancials,
  disclosures,
  signals,
  notes: initialNotes,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  async function refreshNotes() {
    try {
      const res = await fetch(`/api/stocks/${stock.ticker}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? []);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-2 rounded-sm text-sm transition-all border ${
              activeTab === tab ? tabActive : `${tabInactive} border-transparent`
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Overview" && (
        <OverviewTab overview={overview} stock={stock} priceChart={priceChart} />
      )}
      {activeTab === "재무" && (
        <FinancialTab quarterlyFinancials={quarterlyFinancials} annualFinancials={annualFinancials} currency={overview.currency} />
      )}
      {activeTab === "공시" && <DisclosuresTab disclosures={disclosures} />}
      {activeTab === "시그널" && <SignalsTab signals={signals} />}
      {activeTab === "메모" && (
        <NotesTab notes={notes} ticker={stock.ticker} onAdded={refreshNotes} />
      )}
    </div>
  );
}
