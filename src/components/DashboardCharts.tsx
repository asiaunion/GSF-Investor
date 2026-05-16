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
              fill={entry.returnRate >= 0 ? "#10b981" : "#ef4444"}
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

const DONUT_COLORS = ["#10b981", "#6366f1"];

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
