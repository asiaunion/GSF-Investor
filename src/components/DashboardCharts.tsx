"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const STOCK_BAR_COLORS = [
  "var(--color-brand-green)",
  "var(--color-brand-blue)",
  "var(--color-warn-500)",
  "#5b8a72",
  "#6b7c93",
  "#8a9b6e",
  "var(--color-warn-400)",
  "#4a7c8c",
];

const CHART_PLOT_TOP_PT = "pt-0.5";

/** 수익률 막대: 0번(현대차) 상단 고정, 마지막 종목 하단까지 균등 간격 */
const BAR_CHART_MARGIN = { top: 4, right: 10, left: 0, bottom: 0 };

function stockColor(index: number): string {
  return STOCK_BAR_COLORS[index % STOCK_BAR_COLORS.length];
}

/** 한글 등 CJK는 글자당 픽셀 폭이 더 넓음 */
function labelPixelWidth(name: string): number {
  let w = 0;
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    w += code > 0x2e7f ? 14 : 7;
  }
  return w;
}

function estimateYAxisWidth(names: string[], compact: boolean): number {
  if (!compact) return 80;
  const maxW = Math.max(32, ...names.map(labelPixelWidth));
  return Math.min(220, Math.max(72, maxW + 24));
}

function returnAxisTicks(values: number[]): number[] {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const maxAbs = Math.max(Math.abs(max), Math.abs(min));
  const step = maxAbs <= 25 ? 5 : maxAbs <= 50 ? 10 : 25;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const bottom = Math.min(0, Math.floor(min / step) * step);
  const ticks: number[] = [];
  for (let v = bottom; v <= top; v += step) ticks.push(v);
  return ticks;
}

function ReturnBarFooter({ ticks, plotInsetLeft }: { ticks: number[]; plotInsetLeft: number }) {
  return (
    <div
      className="shrink-0 flex items-end justify-center px-1 pb-1 mt-auto w-full"
      style={{ height: 32 }}
    >
      <div
        className="flex w-full justify-between text-[10px] tabular-nums leading-none"
        style={{ marginLeft: plotInsetLeft, marginRight: 10, color: "var(--color-alpha-500)" }}
      >
        {ticks.map((v) => (
          <span key={v}>
            {v >= 0 ? "+" : ""}
            {v}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 수익률 바 차트 ────────────────────────────────────────────────────────────
interface ReturnBarData {
  ticker: string;
  name: string;
  returnRate: number;
}

function CategoryYAxisTick(props: { x?: string | number; y?: string | number; payload?: { value?: string } }) {
  const { x, y, payload } = props;
  const label = payload?.value;
  if (x == null || y == null || !label) return null;
  return (
    <text
      x={Number(x)}
      y={Number(y)}
      dy={3}
      textAnchor="end"
      fill="var(--color-text-secondary)"
      fontSize={11}
      fontFamily="ui-sans-serif, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif"
    >
      {label}
    </text>
  );
}

export function ReturnBarChart({ data, compact = true }: { data: ReturnBarData[]; compact?: boolean }) {
  const sorted = [...data].sort((a, b) => b.returnRate - a.returnRate);
  const yWidth = estimateYAxisWidth(sorted.map((d) => d.name), compact);
  const xTicks = returnAxisTicks(sorted.map((d) => d.returnRate));
  const xDomainMin = xTicks[0] ?? -5;
  const xDomainMax = xTicks[xTicks.length - 1] ?? 20;
  const barThickness = compact ? 24 : 28;

  return (
    <div className="w-full overflow-visible flex flex-col flex-1 min-h-[152px]">
      <div className={`flex-1 min-h-0 w-full overflow-visible ${CHART_PLOT_TOP_PT}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ ...BAR_CHART_MARGIN, left: 2 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" domain={[xDomainMin, xDomainMax]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={yWidth}
              interval={0}
              tickMargin={8}
              axisLine={false}
              tickLine={false}
              padding={{ top: 0, bottom: 0 }}
              tick={CategoryYAxisTick}
            />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ReturnBarData;
            return (
              <div className="bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm shadow-lg">
                <p className="text-text-primary font-semibold">{d.name}</p>
                <p className={d.returnRate >= 0 ? "text-profit-400" : "text-loss-400"}>
                  {d.returnRate >= 0 ? "+" : ""}
                  {d.returnRate.toFixed(2)}%
                </p>
              </div>
            );
          }}
        />
            <Bar
              dataKey="returnRate"
              radius={[0, 4, 4, 0]}
              barSize={barThickness}
              maxBarSize={barThickness}
            >
              {sorted.map((entry, index) => (
              <Cell key={entry.ticker} fill={stockColor(index)} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>
      <ReturnBarFooter ticks={xTicks} plotInsetLeft={yWidth + 2} />
    </div>
  );
}

export function formatKRW(value: number): string {
  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(2)}억원`;
  }
  if (value >= 1_0000) {
    return `${(value / 1_0000).toFixed(0)}만원`;
  }
  return `${value.toLocaleString("ko-KR")}원`;
}
