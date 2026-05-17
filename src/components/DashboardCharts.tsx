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
  Legend,
  type PieLabelRenderProps,
} from "recharts";

// ── 수익률 바 차트 ────────────────────────────────────────────────────────────
interface ReturnBarData {
  ticker: string;
  name: string;
  returnRate: number;
}

export function ReturnBarChart({ data }: { data: ReturnBarData[] }) {
  const sorted = [...data].sort((a, b) => b.returnRate - a.returnRate);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: ReturnBarData }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm shadow-lg">
        <p className="text-white font-semibold">{d.name}</p>
        <p className={d.returnRate >= 0 ? "text-emerald-400" : "text-red-400"}>
          {d.returnRate >= 0 ? "+" : ""}
          {d.returnRate.toFixed(2)}%
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        barCategoryGap="30%"
      >
        <XAxis
          type="number"
          tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="ticker"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={58}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="returnRate" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {sorted.map((entry) => (
            <Cell
              key={entry.ticker}
              fill={entry.returnRate >= 0 ? "var(--color-brand-green)" : "#ef4444"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Core vs Satellite 도넛 차트 ───────────────────────────────────────────────
interface DonutData {
  name: string;
  valueKRW: number;
  pct: number;
}

const DONUT_COLORS = ["var(--color-brand-green)", "var(--color-brand-blue)"];

export function CoreSatelliteDonut({ data }: { data: DonutData[] }) {
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: DonutData }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm shadow-lg">
        <p className="text-white font-semibold">{d.name}</p>
        <p className="text-zinc-300">{formatKRW(d.valueKRW)}</p>
        <p className="text-zinc-400">{d.pct.toFixed(1)}%</p>
      </div>
    );
  };

  const renderCustomLabel = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null;
    const RADIAN = Math.PI / 180;
    const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
    const x = Number(cx) + radius * Math.cos(-Number(midAngle) * RADIAN);
    const y = Number(cy) + radius * Math.sin(-Number(midAngle) * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={600}
      >
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="valueKRW"
          labelLine={false}
          label={renderCustomLabel}
          strokeWidth={2}
          stroke="transparent"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: "#a1a1aa", fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
export function formatKRW(value: number): string {
  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(2)}억원`;
  }
  if (value >= 1_0000) {
    return `${(value / 1_0000).toFixed(0)}만원`;
  }
  return `${value.toLocaleString("ko-KR")}원`;
}

// ── Weighted Contribution 차트 ────────────────────────────────────────────────
// 종목별 포트폴리오 비중(%) + 손익 기여(원화)를 함께 표시하는 복합 bar
interface ContribData {
  ticker: string;
  name: string;
  weightPct: number;        // 평가금액 비중 (%)
  pnlKRW: number;           // 평가손익 (원화)
  category: string;
}

const CAT_COLORS: Record<string, string> = {
  Core: "var(--color-brand-green)",
  Satellite: "var(--color-brand-blue)",
};

export function WeightedContributionChart({ data }: { data: ContribData[] }) {
  const sorted = [...data].sort((a, b) => b.weightPct - a.weightPct);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ContribData }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pnlPos = d.pnlKRW >= 0;
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs shadow-lg min-w-[140px]">
        <p className="text-white font-semibold mb-1.5">{d.name} <span className="text-zinc-500">({d.ticker})</span></p>
        <div className="space-y-1 text-zinc-400">
          <div>비중: <span className="text-zinc-200 font-medium">{d.weightPct.toFixed(1)}%</span></div>
          <div>
            평가손익:{" "}
            <span className={`font-medium ${pnlPos ? "text-emerald-400" : "text-red-400"}`}>
              {pnlPos ? "+" : ""}{formatKRW(d.pnlKRW)}
            </span>
          </div>
          <div>카테고리: <span className="text-zinc-300">{d.category}</span></div>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        barCategoryGap="30%"
      >
        <XAxis
          type="number"
          tickFormatter={(v) => `${v.toFixed(0)}%`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="ticker"
          tick={{ fill: "#a1a1aa", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={58}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="weightPct" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {sorted.map((entry) => (
            <Cell
              key={entry.ticker}
              fill={CAT_COLORS[entry.category] ?? "#71717a"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Sector 집중도 도넛 ────────────────────────────────────────────────────────
interface SectorData {
  sector: string;
  valueKRW: number;
  pct: number;
}

const SECTOR_COLORS = [
  "var(--color-brand-green)", "var(--color-brand-blue)", "var(--color-warn-500)", "var(--color-brand-blue)",
  "var(--color-loss-500)", "var(--color-brand-green)", "var(--color-warn-400)", "var(--color-brand-blue)",
];

export function SectorDonut({ data }: { data: SectorData[] }) {
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: SectorData }>;
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm shadow-lg">
        <p className="text-white font-semibold">{d.sector}</p>
        <p className="text-zinc-300">{formatKRW(d.valueKRW)}</p>
        <p className="text-zinc-400">{d.pct.toFixed(1)}%</p>
      </div>
    );
  };

  const renderCustomLabel = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    if (!cx || !cy || !midAngle || !innerRadius || !outerRadius || !percent) return null;
    if (percent < 0.07) return null;
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
        fontSize={11}
        fontWeight={600}
      >
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          dataKey="valueKRW"
          labelLine={false}
          label={renderCustomLabel}
          strokeWidth={2}
          stroke="transparent"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: "#a1a1aa", fontSize: 11 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

