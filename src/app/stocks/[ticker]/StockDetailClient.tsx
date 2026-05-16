"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

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
  dividendYield: number | null; holdingReturn: number | null;
  portfolio: { quantity: number; avgPrice: number } | null;
  usdkrw: number;
}
interface Financial {
  period: string; revenue: number | null; opIncome: number | null;
  netIncome: number | null; totalAssets: number | null;
  totalEquity: number | null; cashAndEquivalents: number | null;
  debtRatio: number | null; eps: number | null; bps: number | null;
  roe: number | null; dividendPerShare: number | null; source: string;
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
  financials: Financial[];
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
  if (value == null) return <span className="text-zinc-600">—</span>;
  const pos = value >= 0;
  return (
    <span className={`font-semibold ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    HIGH: "bg-red-500", MEDIUM: "bg-amber-500", LOW: "bg-emerald-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[severity] ?? "bg-zinc-500"}`} />;
}

// ── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ overview, stock, priceChart }: { overview: Overview; stock: Stock; priceChart: PricePoint[] }) {
  const { currentPrice, currency, per, pbr, dividendYield, holdingReturn, portfolio, usdkrw } = overview;
  const evalKRW = currentPrice != null && portfolio
    ? (currency === "USD" ? currentPrice * portfolio.quantity * usdkrw : currentPrice * portfolio.quantity)
    : null;

  return (
    <div className="space-y-6">
      {/* Price hero */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-zinc-500 text-xs mb-1">현재가 · {overview.priceDate ?? "—"}</div>
            <div className="text-3xl font-bold text-white tracking-tight">
              {fmtPrice(currentPrice, currency)}
            </div>
            {currency === "USD" && currentPrice && (
              <div className="text-zinc-500 text-sm mt-1">
                ≈ ₩{(currentPrice * usdkrw).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
          {portfolio && (
            <div className="text-right">
              <div className="text-zinc-500 text-xs mb-1">보유 수익률</div>
              <div className="text-xl font-bold"><ReturnBadge value={holdingReturn} /></div>
              <div className="text-zinc-600 text-xs mt-1">
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
          { label: "평가금액", value: evalKRW != null ? `₩${(evalKRW / 1e8).toFixed(2)}억` : "—" },
        ].map((m) => (
          <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-600 text-[10px] uppercase tracking-wider">{m.label}</div>
            <div className="text-white text-lg font-semibold mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Thesis */}
      {stock.thesis && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">투자 테제</div>
          <p className="text-zinc-300 text-sm leading-relaxed">{stock.thesis}</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: 재무 ────────────────────────────────────────────────────────────────
function FinancialTab({ financials, currency }: { financials: Financial[]; currency: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="text-zinc-400 text-sm font-medium mb-4">손익계산서 추이</div>
        <IncomeLineChart data={financials} currency={currency} />
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="text-zinc-400 text-sm font-medium mb-4">재무상태표</div>
        <BalanceSheetBarChart data={financials} currency={currency} />
      </div>
      {/* Table */}
      {financials.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-zinc-500 font-medium">기간</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">매출</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">영업이익</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">순이익</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">ROE</th>
                  <th className="px-4 py-3 text-right text-zinc-500 font-medium">EPS</th>
                </tr>
              </thead>
              <tbody>
                {[...financials].reverse().map((f) => (
                  <tr key={f.period} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-zinc-300 font-medium">{f.period}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{fmtLarge(f.revenue, currency)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${f.opIncome != null && f.opIncome >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtLarge(f.opIncome, currency)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${f.netIncome != null && f.netIncome >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtLarge(f.netIncome, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{fmt(f.roe)}%</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{fmtPrice(f.eps, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
        <div key={d.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              d.source === "DART"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}>{d.source}</span>
            <span className="text-zinc-600 text-xs">{d.filedAt.slice(0, 10)}</span>
          </div>
          <div className="text-zinc-200 text-sm font-medium leading-snug">{d.title}</div>
          {d.summaryAi && (
            <div className="mt-2 text-zinc-500 text-xs leading-relaxed line-clamp-3">
              {d.summaryAi}
            </div>
          )}
          {d.rawUrl && (
            <a
              href={d.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-emerald-500 hover:text-emerald-400 text-xs transition-colors"
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
        <div key={s.id} className={`bg-zinc-900 border rounded-xl p-4 transition-colors ${
          s.isResolved ? "border-zinc-800/50 opacity-60" : "border-zinc-800 hover:border-zinc-700"
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <SeverityDot severity={s.severity} />
              <span className="text-zinc-300 text-xs font-medium">{s.type.replace(/_/g, " ")}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                s.severity === "HIGH"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : s.severity === "MEDIUM"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>{s.severity}</span>
            </div>
            <span className="text-zinc-600 text-xs">{s.detectedAt.slice(0, 10)}</span>
          </div>
          <div className="text-zinc-300 text-sm leading-relaxed">{s.description}</div>
          {s.resolvedNote && (
            <div className="mt-2 text-zinc-600 text-xs">✓ {s.resolvedNote}</div>
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
      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-zinc-400 text-xs font-medium mb-2">새 메모 작성</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="투자 메모를 작성하세요 (마크다운 지원)..."
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 text-sm placeholder:text-zinc-600 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-medium transition-all"
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
          <div key={note.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-600 text-[10px] mb-2">{note.createdAt.slice(0, 16)}</div>
            <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{note.contentMd}</div>
          </div>
        ))
      )}
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-zinc-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="text-zinc-500 text-sm">{label}</p>
      {sub && <p className="text-zinc-700 text-xs">{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StockDetailClient({
  stock,
  overview,
  priceChart,
  financials,
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
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/25"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
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
        <FinancialTab financials={financials} currency={overview.currency} />
      )}
      {activeTab === "공시" && <DisclosuresTab disclosures={disclosures} />}
      {activeTab === "시그널" && <SignalsTab signals={signals} />}
      {activeTab === "메모" && (
        <NotesTab notes={notes} ticker={stock.ticker} onAdded={refreshNotes} />
      )}
    </div>
  );
}
