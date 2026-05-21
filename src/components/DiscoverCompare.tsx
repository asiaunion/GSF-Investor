"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { economistCard, linkMuted, marketBadge } from "@/lib/economist-ui";
import { ChartPeriodTabs, type ChartPeriod } from "@/components/ChartPeriodTabs";
import { EconomistAlert } from "@/components/EconomistPage";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

const LINE_COLORS = [
  "var(--color-brand-green)",
  "var(--color-brand-blue)",
  "var(--color-warn-500)",
  "#5b8a72",
  "#6b7c93",
];

type Meta = { ticker: string; name: string; market: string };
type ScreenRow = {
  ticker: string;
  name: string;
  market: string;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  dividendYield: number | null;
  latestPrice: number | null;
};

export default function DiscoverCompare({ tickers }: { tickers: string[] }) {
  const [period, setPeriod] = useState<ChartPeriod>("3M");
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [meta, setMeta] = useState<Meta[]>([]);
  const [metrics, setMetrics] = useState<ScreenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tickerKey = tickers.join(",");

  const loadPrices = useCallback(async (range: ChartPeriod = period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/discover/compare-prices?tickers=${encodeURIComponent(tickerKey)}&range=${range}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setChartData(data.chartData ?? []);
      setMeta(data.meta ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가격 비교 로드 실패");
      setChartData([]);
      setMeta([]);
    } finally {
      setLoading(false);
    }
  }, [tickerKey, period]);

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/discover/screen?market=ALL&held=all");
      const data = await res.json();
      if (!res.ok) return;
      const set = new Set(tickers);
      const rows: ScreenRow[] = (data.stocks ?? []).filter((s: ScreenRow) => set.has(s.ticker));
      setMetrics(rows);
    } catch {
      setMetrics([]);
    }
  }, [tickers]);

  useEffect(() => {
    if (tickers.length < 2) return;
    void loadPrices(period);
    void loadMetrics();
  }, [tickers.length, tickerKey, period, loadPrices, loadMetrics]);

  const lines = useMemo(
    () => meta.map((m, i) => ({ key: m.ticker, color: LINE_COLORS[i % LINE_COLORS.length] })),
    [meta]
  );

  if (tickers.length < 2) {
    return (
      <div className="p-3 bg-warn-bg border border-warn-border rounded-sm text-sm text-warn-500">
        비교하려면 URL에 최소 2개 티커가 필요합니다. 예:{" "}
        <code className="text-brand-green">/discover?compare=005380,000660</code>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/discover" className={`text-sm ${linkMuted}`}>
          ← 스크리너로 돌아가기
        </Link>
        <ChartPeriodTabs
          value={period}
          onChange={(p) => {
            setPeriod(p);
            void loadPrices(p);
          }}
          idPrefix="cmp-period"
        />
      </div>

      {error && <EconomistAlert variant="error">{error}</EconomistAlert>}

      <div className={`${economistCard} px-3 pt-3 pb-2`}>
        <h2 className="text-sm font-semibold text-text-primary mb-1">수익률 비교 (정규화 %)</h2>
        <p className="text-[11px] text-text-muted mb-2">기간 시작 = 100</p>
        {loading ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-text-muted">
            불러오는 중…
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-text-muted">
            가격 데이터 없음
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {lines.map((l) => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={false}
                  name={l.key}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className={`${economistCard} overflow-hidden`}>
        <div className="px-4 py-2 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">지표 비교</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated/40">
                <th className="text-left px-3 py-1 font-medium text-text-muted">종목</th>
                <th className="text-right px-2 py-1 font-medium text-text-muted">현재가</th>
                <th className="text-right px-2 py-1 font-medium text-text-muted">PER</th>
                <th className="text-right px-2 py-1 font-medium text-text-muted">PBR</th>
                <th className="text-right px-2 py-1 font-medium text-text-muted">ROE</th>
                <th className="text-right px-2 py-1 font-medium text-text-muted">배당%</th>
              </tr>
            </thead>
            <tbody>
              {metrics.length > 0
                ? metrics.map((m) => (
                    <tr key={m.ticker} className="border-b border-border-default/50">
                      <td className="px-3 py-2">
                        <Link href={`/stocks/${m.ticker}`} className="font-medium text-text-primary hover:text-brand-green">
                          {m.name}
                        </Link>
                        <span className="text-text-muted text-xs ml-1">{m.ticker}</span>
                        <span className={`ml-1 text-[10px] ${marketBadge[m.market] ?? ""}`}>
                          {m.market}
                        </span>
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums">
                        {m.latestPrice?.toLocaleString() ?? "—"}
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums">{m.per ?? "—"}</td>
                      <td className="text-right px-2 py-2 tabular-nums">{m.pbr ?? "—"}</td>
                      <td className="text-right px-2 py-2 tabular-nums">
                        {m.roe != null ? `${m.roe}%` : "—"}
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums">
                        {m.dividendYield != null ? `${m.dividendYield}%` : "—"}
                      </td>
                    </tr>
                  ))
                : meta.map((m) => (
                    <tr key={m.ticker} className="border-b border-border-default/50">
                      <td className="px-3 py-2" colSpan={6}>
                        <Link href={`/stocks/${m.ticker}`}>{m.name}</Link> ({m.ticker})
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <Link href="/discover" className="text-sm text-brand-green hover:underline">
        스크리너에서 다시 선택
      </Link>
    </div>
  );
}
