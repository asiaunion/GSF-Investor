"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  type PieLabelRenderProps,
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

const SECTOR_COLORS = [
  "var(--color-brand-green)",
  "var(--color-brand-blue)",
  "var(--color-warn-500)",
  "var(--color-brand-blue)",
  "var(--color-loss-500)",
  "var(--color-brand-green)",
  "var(--color-warn-400)",
  "var(--color-brand-blue)",
];

const DONUT_CORE_COLORS = ["var(--color-brand-green)", "var(--color-brand-blue)"];

/** 도넛 범례와 수익률 % 축 하단 라인 정렬 */
const CHART_FOOTER_H = 32;
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

/** 도넛이 잘리지 않도록 픽셀 기준 cy·height 계산 (범례는 차트 밖) */
function donutLayout(compact: boolean) {
  const outerR = compact ? 82 : 94;
  const innerR = compact ? 51 : 59;
  const margin = { top: 2, right: 4, bottom: 2, left: 4 };
  const height = margin.top + outerR * 2 + margin.bottom;
  const cy = margin.top + outerR;
  return { outerR, innerR, margin, height, cy };
}

function ChartFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 flex items-end justify-center px-1 pb-1 mt-auto w-full"
      style={{ height: CHART_FOOTER_H }}
    >
      {children}
    </div>
  );
}

function DonutLegend({ items, colors }: { items: { name: string }[]; colors: string[] }) {
  return (
    <ChartFooter>
    <ul className="flex flex-wrap justify-center items-end gap-x-2.5 gap-y-1 w-full">
      {items.map((item, i) => (
        <li key={item.name} className="flex items-center gap-1 min-w-0 max-w-[46%]">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: colors[i % colors.length] }}
          />
          <span className="text-[11px] text-text-secondary truncate leading-tight">{item.name}</span>
        </li>
      ))}
    </ul>
    </ChartFooter>
  );
}

function returnAxisTicks(values: number[]): number[] {
  const max = Math.max(0, ...values);
  const step = max <= 25 ? 5 : 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

function ReturnBarFooter({ ticks, plotInsetLeft }: { ticks: number[]; plotInsetLeft: number }) {
  return (
    <ChartFooter>
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
    </ChartFooter>
  );
}

function DonutPercentLabel(compact: boolean, minPercent = 0.05) {
  return function Label(props: PieLabelRenderProps) {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null;
    if (percent < minPercent) return null;
    const RADIAN = Math.PI / 180;
    const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
    const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
    const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={compact ? 11 : 12}
        fontWeight={600}
      >
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };
}

interface DonutSlice {
  name: string;
  valueKRW: number;
  pct?: number;
}

function GenericDonut({
  data,
  colors,
  compact = true,
  labelMinPercent = 0.05,
  tooltip,
}: {
  data: DonutSlice[];
  colors: string[];
  compact?: boolean;
  labelMinPercent?: number;
  tooltip: (d: DonutSlice) => React.ReactNode;
}) {
  const { outerR, innerR, margin, height, cy } = donutLayout(compact);

  return (
    <div className="w-full overflow-visible flex flex-col flex-1 min-h-[152px]">
      <div
        className={`flex-1 min-h-0 w-full flex items-start justify-center ${CHART_PLOT_TOP_PT}`}
        style={{ minHeight: height }}
      >
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={margin}>
            <Pie
              data={data}
              cx="50%"
              cy={cy}
              innerRadius={innerR}
              outerRadius={outerR}
              dataKey="valueKRW"
              nameKey="name"
              labelLine={false}
              label={DonutPercentLabel(compact, labelMinPercent)}
              strokeWidth={2}
              stroke="var(--color-bg-surface)"
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as DonutSlice;
                return (
                  <div className="bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm shadow-lg">
                    {tooltip(d)}
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <DonutLegend items={data} colors={colors} />
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
            <XAxis type="number" domain={[0, xDomainMax]} hide />
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

// ── Core vs Satellite ─────────────────────────────────────────────────────────
interface DonutData {
  name: string;
  valueKRW: number;
  pct: number;
}

export function CoreSatelliteDonut({ data, compact = true }: { data: DonutData[]; compact?: boolean }) {
  return (
    <GenericDonut
      data={data}
      colors={DONUT_CORE_COLORS}
      compact={compact}
      tooltip={(d) => (
        <>
          <p className="text-text-primary font-semibold">{d.name}</p>
          <p className="text-text-secondary">{formatKRW(d.valueKRW)}</p>
          <p className="text-text-secondary">{(d.pct ?? 0).toFixed(1)}%</p>
        </>
      )}
    />
  );
}

// ── 종목 비중 도넛 ────────────────────────────────────────────────────────────
interface ContribData {
  ticker: string;
  name: string;
  weightPct: number;
  pnlKRW: number;
  category: string;
}

export function WeightDonut({ data, compact = true }: { data: ContribData[]; compact?: boolean }) {
  const chartData: DonutSlice[] = [...data]
    .sort((a, b) => b.weightPct - a.weightPct)
    .map((d) => ({
      name: d.name,
      valueKRW: d.weightPct,
      pct: d.weightPct,
    }));

  const meta = new Map(data.map((d) => [d.name, d]));

  return (
    <GenericDonut
      data={chartData}
      colors={chartData.map((_, i) => stockColor(i))}
      compact={compact}
      labelMinPercent={0.06}
      tooltip={(d) => {
        const row = meta.get(d.name);
        const pnlPos = (row?.pnlKRW ?? 0) >= 0;
        return (
          <>
            <p className="text-text-primary font-semibold">
              {d.name}
              {row?.ticker && <span className="text-text-muted font-normal ml-1">({row.ticker})</span>}
            </p>
            <p className="text-text-secondary">비중 {(d.pct ?? 0).toFixed(1)}%</p>
            {row && (
              <p className={pnlPos ? "text-profit-400" : "text-loss-400"}>
                평가손익 {pnlPos ? "+" : ""}
                {formatKRW(row.pnlKRW)}
              </p>
            )}
          </>
        );
      }}
    />
  );
}

/** @deprecated WeightDonut 사용 */
export function WeightedContributionChart(props: { data: ContribData[]; compact?: boolean }) {
  return <WeightDonut {...props} />;
}

// ── Sector 집중도 ─────────────────────────────────────────────────────────────
interface SectorData {
  sector: string;
  valueKRW: number;
  pct: number;
}

export function SectorDonut({ data, compact = true }: { data: SectorData[]; compact?: boolean }) {
  const chartData: DonutSlice[] = data.map((d) => ({
    name: d.sector,
    valueKRW: d.valueKRW,
    pct: d.pct,
  }));

  return (
    <GenericDonut
      data={chartData}
      colors={SECTOR_COLORS}
      compact={compact}
      labelMinPercent={0.07}
      tooltip={(d) => (
        <>
          <p className="text-text-primary font-semibold">{d.name}</p>
          <p className="text-text-secondary">{formatKRW(d.valueKRW)}</p>
          <p className="text-text-secondary">{(d.pct ?? 0).toFixed(1)}%</p>
        </>
      )}
    />
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
