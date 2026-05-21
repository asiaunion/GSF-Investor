"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { economistCard } from "@/lib/economist-ui";
import { ChartPeriodTabs, type ChartPeriod } from "@/components/ChartPeriodTabs";

const BENCHMARK_TICKER = "069500";

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

type HoldingPoint = {
  date: string;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
};

type ChartRow = {
  date: string;
  portfolio: number;
  benchmark: number | null;
};

function filterByPeriod(rows: HoldingPoint[], range: ChartPeriod): HoldingPoint[] {
  if (range === "ALL" || rows.length === 0) return rows;
  const days =
    range === "1M" ? 30 : range === "3M" ? 90 : range === "6M" ? 180 : range === "1Y" ? 365 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= cutoffStr);
}

export default function PortfolioPerformanceChart() {
  const [period, setPeriod] = useState<ChartPeriod>("3M");
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasBenchmark, setHasBenchmark] = useState(false);

  const load = useCallback(async (range: ChartPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const [holdRes, benchRes] = await Promise.all([
        fetch("/api/holdings/history"),
        fetch(
          `/api/discover/compare-prices?tickers=${BENCHMARK_TICKER}&range=${range}`
        ),
      ]);
      const holdJson = await holdRes.json();
      const benchJson = await benchRes.json();
      if (!holdRes.ok) {
        throw new Error(holdJson.error || holdRes.statusText);
      }

      const raw: HoldingPoint[] = (Array.isArray(holdJson) ? holdJson : []).map(
        (r: HoldingPoint) => ({
          date: String(r.date),
          totalMarketValue: Number(r.totalMarketValue ?? 0),
          totalUnrealizedPnl: Number(r.totalUnrealizedPnl ?? 0),
        })
      );
      const filtered = filterByPeriod(raw, range).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const benchMap = new Map<string, number>();
      if (benchRes.ok && benchJson.chartData) {
        for (const row of benchJson.chartData as Record<string, string | number>[]) {
          const d = String(row.date);
          const v = row[BENCHMARK_TICKER];
          if (typeof v === "number") benchMap.set(d, v);
        }
      }
      setHasBenchmark(benchMap.size > 0);

      if (filtered.length === 0) {
        setChartData([]);
        return;
      }

      const base = filtered[0].totalMarketValue;
      const merged: ChartRow[] = filtered.map((p) => ({
        date: p.date.slice(5),
        portfolio: base > 0 ? Math.round((p.totalMarketValue / base) * 10000) / 100 : 100,
        benchmark: benchMap.get(p.date) ?? null,
      }));

      setChartData(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const hasEnough = chartData.length >= 2;

  return (
    <div className={`${economistCard} px-3 pt-3 pb-2 min-h-[260px] flex flex-col`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">포트폴리오 수익률</h2>
          <p className="text-[11px] text-text-muted">
            평가액 기준 (100=시작) · 벤치 {BENCHMARK_TICKER}
            {hasBenchmark ? "" : " (벤치 데이터 없음)"}
          </p>
        </div>
        <ChartPeriodTabs
          value={period}
          onChange={(p) => setPeriod(p)}
          idPrefix="pf-period"
        />
      </div>

      <div className="flex-1 min-h-[200px]">
        {loading && (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">
            불러오는 중…
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-xs text-loss-400">
            {error}
          </div>
        )}
        {!loading && !error && !hasEnough && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <p className="text-xs text-text-muted">
              보유 스냅샷이 {chartData.length}일치입니다. 추이는 2일 이상 필요합니다.
            </p>
            <p className="text-[11px] text-text-muted">
              GitHub Actions <code className="text-brand-green/90">holding_snapshot</code> cron을
              확인하세요.
            </p>
          </div>
        )}
        {!loading && !error && hasEnough && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-default)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value.toFixed(2) : String(value ?? "—");
                  const label = name === "portfolio" ? "포트폴리오" : "벤치(069500)";
                  return [`${n}%`, label];
                }}
                contentStyle={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 4,
                  fontSize: 11,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(v) => (v === "portfolio" ? "포트폴리오" : "069500")}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="var(--color-brand-green)"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="portfolio"
              />
              {hasBenchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="var(--color-brand-blue)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                  name="benchmark"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
