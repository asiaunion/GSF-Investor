"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { economistCard } from "@/lib/economist-ui";
import { ChartPeriodTabs, type ChartPeriod } from "@/components/ChartPeriodTabs";

function formatKrw(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
}

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

type HistoryPoint = {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  securitiesKrw: number;
  wealthAssetsKrw: number;
  liabilitiesKrw: number;
};

type ChartRow = {
  date: string;
  securities: number;
  wealth: number;
  netWorth: number;
  totalDebt: number;
};

function formatAxisKrw(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return String(Math.round(v));
}

function NetWorthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-bg-surface border border-border-strong rounded-sm px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      <p className="text-text-secondary">
        순자산 <span className="text-text-primary font-bold tabular-nums">{formatKrw(p.netWorth)}</span>
      </p>
      <p className="text-text-muted tabular-nums">주식 {formatKrw(p.securities)}</p>
      <p className="text-text-muted tabular-nums">비주식·기타 {formatKrw(p.wealth)}</p>
      <p className="text-text-muted tabular-nums">부채 {formatKrw(p.totalDebt)}</p>
    </div>
  );
}

export default function NetWorthHistoryChart() {
  const [period, setPeriod] = useState<ChartPeriod>("3M");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: ChartPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/net-worth/history?range=${range}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || res.statusText);
      setPoints(data.points ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const chartData: ChartRow[] = points.map((p) => ({
    date: p.date.slice(5),
    securities: p.securitiesKrw,
    wealth: p.wealthAssetsKrw,
    netWorth: p.netWorth,
    totalDebt: p.totalDebt,
  }));

  const hasEnough = chartData.length >= 2;

  return (
    <div className={`${economistCard} px-3 pt-3 pb-2 min-h-[260px] flex flex-col`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">순자산 추이</h2>
          <p className="text-[11px] text-text-muted">주식 · 비주식 자산 (스냅샷 기준)</p>
        </div>
        <ChartPeriodTabs value={period} onChange={setPeriod} idPrefix="nw-period" />
      </div>

      <div className="flex-1 min-h-[200px]">
        {loading && (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">불러오는 중…</div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-xs text-loss-400">{error}</div>
        )}
        {!loading && !error && !hasEnough && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
            <p className="text-xs text-text-muted">
              스냅샷이 {chartData.length}건입니다. 추이 차트는 2건 이상 필요합니다.
            </p>
            <p className="text-[11px] text-text-muted">
              <code className="text-brand-green/90">/api/cron/net-worth-snapshot</code> 또는 주간 cron을 실행하세요.
            </p>
            <Link href="/wealth" className="text-xs text-brand-green hover:underline">
              전체 자산 보기 →
            </Link>
          </div>
        )}
        {!loading && !error && hasEnough && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwSecurities" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(220, 80%, 55%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(220, 80%, 55%)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="nwWealth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(145, 60%, 50%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(145, 60%, 50%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxisKrw}
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<NetWorthTooltip />} />
              <Area
                type="monotone"
                dataKey="securities"
                stackId="assets"
                stroke="hsl(220, 80%, 55%)"
                fill="url(#nwSecurities)"
                name="주식"
              />
              <Area
                type="monotone"
                dataKey="wealth"
                stackId="assets"
                stroke="hsl(145, 60%, 50%)"
                fill="url(#nwWealth)"
                name="비주식·기타"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
