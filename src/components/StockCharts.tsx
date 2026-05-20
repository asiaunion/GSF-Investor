"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

interface Financial {
  period: string;
  revenue: number | null;
  opIncome: number | null;
  netIncome: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  cashAndEquivalents: number | null;
  debtRatio: number | null;
  eps: number | null;
  bps: number | null;
  roe: number | null;
  dividendPerShare: number | null;
  operCashFlow: number | null;
  source: string;
}

interface PricePoint {
  date: string;
  price: number;
}

type Palette = {
  revenue: string;
  netFill: string;
  opFill: string;
  ocfFill: string;
  debtStroke: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
};

/** 확정 Editorial 팔레트 */
const CHART_PALETTE: Palette = {
  revenue: "#6b5d4f",
  netFill: "rgba(45, 74, 62, 0.28)",
  opFill: "#2d4a3e",
  ocfFill: "#4a6b7c",
  debtStroke: "#a67c52",
  grid: "rgba(60, 50, 40, 0.08)",
  axis: "var(--color-text-secondary)",
  tooltipBg: "var(--color-bg-surface)",
  tooltipBorder: "var(--color-border-strong)",
};

function fmtAmt(v: number | null, currency: string): string {
  if (v == null) return "—";
  if (currency === "USD") {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
  }
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}조`;
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toFixed(0);
}

function chartTooltipStyle(p: Palette) {
  return {
    background: p.tooltipBg,
    border: `1px solid ${p.tooltipBorder}`,
    borderRadius: 6,
    fontSize: 12,
    color: "var(--color-text-primary)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
  };
}

const FINANCIAL_BAR_SIZE = 34;

function clusterBarWidth(slotWidth: number): number {
  return Math.min(32, slotWidth * 0.62);
}

type ProfitPayload = {
  netIncome?: number | null;
  opIncome?: number | null;
};

/** 순이익·영업이익 동일 폭 막대 겹침 (영업이익이 위에, 높이는 각 값 비율) */
function ProfitOverlapShape(
  props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: ProfitPayload;
  },
  palette: Palette
) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const net = payload?.netIncome;
  const op = payload?.opIncome;
  if (net == null || height <= 0) return null;

  const center = x + width / 2;
  const barW = clusterBarWidth(width);
  const netH = Math.max(0, height);
  const opH =
    op != null && net > 0 ? Math.min(netH, (Math.abs(op) / Math.abs(net)) * netH) : 0;
  const opY = y + netH - opH;
  const left = center - barW / 2;

  return (
    <g>
      <rect x={left} y={y} width={barW} height={netH} rx={4} fill={palette.netFill} />
      {op != null && opH > 0 && (
        <rect x={left} y={opY} width={barW} height={opH} rx={4} fill={palette.opFill} />
      )}
    </g>
  );
}

function OcfBarShape(
  props: { x?: number; y?: number; width?: number; height?: number },
  palette: Palette
) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  if (height <= 0) return null;
  const barW = clusterBarWidth(width);
  const left = x + width / 2 - barW / 2;
  return (
    <rect
      x={left}
      y={y}
      width={barW}
      height={height}
      rx={4}
      fill={palette.ocfFill}
      opacity={0.92}
    />
  );
}

function FinancialChartLegend({ p }: { p: Palette }) {
  const items: { label: string; kind: "bar" | "line"; color: string; dashed?: boolean }[] = [
    { label: "순이익", kind: "bar", color: p.netFill },
    { label: "영업이익", kind: "bar", color: p.opFill },
    { label: "영업현금흐름", kind: "bar", color: p.ocfFill },
    { label: "매출", kind: "line", color: p.revenue },
    { label: "부채비율", kind: "line", color: p.debtStroke, dashed: true },
  ];

  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 pt-3 text-[11px] text-text-secondary list-none m-0 p-0">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.kind === "bar" ? (
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: item.color }}
              aria-hidden
            />
          ) : (
            <span className="inline-flex w-4 shrink-0 items-center" aria-hidden>
              <span
                className="block w-full h-0 border-t-[1.5px]"
                style={{
                  borderColor: item.color,
                  borderStyle: item.dashed ? "dashed" : "solid",
                }}
              />
            </span>
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ── 주가 차트 ──────────────────────────────────────────────────────────────────
export function PriceAreaChart({
  data,
  currency,
}: {
  data: PricePoint[];
  currency: string;
}) {
  if (!data || data.length === 0) return <Empty label="주가 데이터 없음" />;

  const first = data[0].price;
  const last = data[data.length - 1].price;
  const isUp = last >= first;
  const color = isUp ? "var(--color-brand-green)" : "var(--color-brand-red)";

  const formatted = data.map((d) => ({
    date: d.date.slice(5),
    price: d.price,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border-default)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(formatted.length / 5)}
        />
        <YAxis
          tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            currency === "USD" ? `$${v.toFixed(0)}` : `₩${(v / 1000).toFixed(0)}K`
          }
          width={54}
        />
        <Tooltip
          contentStyle={chartTooltipStyle(CHART_PALETTE)}
          formatter={(v) =>
            typeof v === "number"
              ? currency === "USD"
                ? [`$${v.toFixed(2)}`, "종가"]
                : [`₩${v.toLocaleString("ko-KR")}`, "종가"]
              : [String(v ?? "—"), "종가"]
          }
          labelStyle={{ color: "var(--color-text-secondary)" }}
        />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── 통합 재무 차트 (손익 + 건전성) ─────────────────────────────────────────────
export function UnifiedFinancialChart({
  data,
  currency,
}: {
  data: Financial[];
  currency: string;
}) {
  if (!data || data.length === 0) return <Empty label="재무 데이터 없음" />;

  const p = CHART_PALETTE;
  const formatted = data.map((d) => ({
    period: d.period.replace("FY", ""),
    revenue: d.revenue,
    opIncome: d.opIncome,
    netIncome: d.netIncome,
    operCashFlow: d.operCashFlow,
    debtRatio: d.debtRatio,
  }));

  const UnifiedTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ payload?: (typeof formatted)[0] }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    const op = row.opIncome;
    const net = row.netIncome;
    const ratio =
      op != null && net != null && net !== 0
        ? ` (순이익의 ${Math.round((op / net) * 100)}%)`
        : "";
    return (
      <div style={chartTooltipStyle(p)} className="px-3 py-2.5 space-y-1.5 min-w-[180px]">
        <p className="text-[10px] text-text-muted border-b border-border-default pb-1.5 mb-1">
          {label}
        </p>
        <p className="text-xs flex justify-between gap-3">
          <span className="text-text-muted">매출</span>
          <span>{fmtAmt(row.revenue, currency)}</span>
        </p>
        <p className="text-xs flex justify-between gap-3">
          <span style={{ color: p.opFill }}>영업이익</span>
          <span>{fmtAmt(op, currency)}</span>
        </p>
        <p className="text-xs flex justify-between gap-3">
          <span style={{ color: p.netFill }}>순이익</span>
          <span>
            {fmtAmt(net, currency)}
            {ratio}
          </span>
        </p>
        <p className="text-xs flex justify-between gap-3">
          <span style={{ color: p.ocfFill }}>영업현금흐름</span>
          <span>{fmtAmt(row.operCashFlow, currency)}</span>
        </p>
        <p className="text-xs flex justify-between gap-3">
          <span style={{ color: p.debtStroke }}>부채비율</span>
          <span>{row.debtRatio != null ? `${row.debtRatio.toFixed(1)}%` : "—"}</span>
        </p>
      </div>
    );
  };

  return (
    <div>
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={formatted}
        margin={{ top: 12, right: 88, left: 4, bottom: 4 }}
        barCategoryGap="24%"
        barGap={4}
      >
        <CartesianGrid stroke={p.grid} strokeDasharray="2 6" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: p.axis, fontSize: 10, fontFamily: "inherit" }}
          tickLine={false}
          axisLine={{ stroke: p.grid }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: p.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtAmt(v, currency)}
          width={56}
        />
        <YAxis
          yAxisId="revenue"
          orientation="right"
          tick={{ fill: p.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtAmt(v, currency)}
          width={48}
        />
        <YAxis
          yAxisId="debt"
          orientation="right"
          tick={{ fill: p.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
          width={40}
          domain={[0, "auto"]}
        />
        <Tooltip content={<UnifiedTooltip />} />
        <Bar
          yAxisId="left"
          dataKey="netIncome"
          name="순이익"
          barSize={FINANCIAL_BAR_SIZE}
          legendType="none"
          shape={(barProps) => ProfitOverlapShape(barProps, p)}
        />
        <Bar
          yAxisId="left"
          dataKey="operCashFlow"
          name="영업현금흐름"
          barSize={FINANCIAL_BAR_SIZE}
          legendType="none"
          shape={(barProps) => OcfBarShape(barProps, p)}
        />
        <Line
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          name="매출"
          stroke={p.revenue}
          strokeWidth={1.75}
          dot={{ r: 2.5, fill: "var(--color-bg-surface)", stroke: p.revenue, strokeWidth: 1.5 }}
          activeDot={{ r: 4, strokeWidth: 2 }}
          connectNulls
          legendType="none"
        />
        <Line
          yAxisId="debt"
          type="monotone"
          dataKey="debtRatio"
          name="부채비율"
          stroke={p.debtStroke}
          strokeWidth={1.75}
          strokeDasharray="8 5"
          isAnimationActive={false}
          animationDuration={0}
          dot={{ r: 3, fill: "var(--color-bg-surface)", stroke: p.debtStroke, strokeWidth: 1.5 }}
          activeDot={{ r: 5, stroke: p.debtStroke, fill: "var(--color-bg-surface)" }}
          connectNulls
          legendType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
    <FinancialChartLegend p={p} />
    </div>
  );
}

/** @deprecated UnifiedFinancialChart 사용 */
export function IncomeLineChart(props: {
  data: Financial[];
  currency: string;
}) {
  return <UnifiedFinancialChart {...props} />;
}

/** @deprecated UnifiedFinancialChart 사용 */
export function BalanceSheetBarChart(props: {
  data: Financial[];
  currency: string;
}) {
  return <UnifiedFinancialChart {...props} />;
}

/** @deprecated UnifiedFinancialChart 사용 */
export function CashFlowAndDebtChart(props: {
  data: Financial[];
  currency: string;
}) {
  return <UnifiedFinancialChart {...props} />;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center">
      <span className="text-text-disabled text-sm">{label}</span>
    </div>
  );
}

