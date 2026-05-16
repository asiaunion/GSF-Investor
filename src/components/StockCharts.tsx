"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
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
  source: string;
}

interface PricePoint {
  date: string;
  price: number;
}

// ── 숫자 포맷 ──────────────────────────────────────────────────────────────────
function fmtAmt(v: number | null, currency: string): string {
  if (v == null) return "—";
  if (currency === "USD") {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
  }
  // KRW
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}조`;
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return v.toFixed(0);
}

// ── 주가 차트 (Area) ───────────────────────────────────────────────────────────
export function PriceAreaChart({
  data,
  currency,
}: {
  data: PricePoint[];
  currency: string;
}) {
  if (!data || data.length === 0)
    return <Empty label="주가 데이터 없음" />;

  const first = data[0].price;
  const last = data[data.length - 1].price;
  const isUp = last >= first;
  const color = isUp ? "#10b981" : "#f87171";

  const formatted = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    price: d.price,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={Math.floor(formatted.length / 5)}
        />
        <YAxis
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            currency === "USD" ? `$${v.toFixed(0)}` : `₩${(v / 1000).toFixed(0)}K`
          }
          width={54}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
            color: "#f4f4f5",
          }}
          formatter={(v) =>
            typeof v === "number"
              ? currency === "USD"
                ? [`$${v.toFixed(2)}`, "종가"]
                : [`₩${v.toLocaleString("ko-KR")}`, "종가"]
              : [String(v ?? "—"), "종가"]
          }
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#priceGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── 손익계산서 라인차트 ────────────────────────────────────────────────────────
export function IncomeLineChart({
  data,
  currency,
}: {
  data: Financial[];
  currency: string;
}) {
  if (!data || data.length === 0)
    return <Empty label="재무 데이터 없음" />;

  const formatted = data.map((d) => ({
    period: d.period,
    revenue: d.revenue,
    opIncome: d.opIncome,
    netIncome: d.netIncome,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtAmt(v, currency)}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
            color: "#f4f4f5",
          }}
          formatter={(v, name) => [fmtAmt(typeof v === 'number' ? v : null, currency), String(name)]}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="매출"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="opIncome"
          name="영업이익"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3, fill: "#10b981" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="netIncome"
          name="순이익"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3, fill: "#f59e0b" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── 재무상태표 바차트 ──────────────────────────────────────────────────────────
export function BalanceSheetBarChart({
  data,
  currency,
}: {
  data: Financial[];
  currency: string;
}) {
  if (!data || data.length === 0)
    return <Empty label="재무상태표 데이터 없음" />;

  const formatted = data.map((d) => ({
    period: d.period,
    totalAssets: d.totalAssets,
    totalEquity: d.totalEquity,
    cashAndEquivalents: d.cashAndEquivalents,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#52525b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtAmt(v, currency)}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 8,
            fontSize: 12,
            color: "#f4f4f5",
          }}
          formatter={(v, name) => [fmtAmt(typeof v === 'number' ? v : null, currency), String(name)]}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 8 }}
        />
        <Bar dataKey="totalAssets" name="총자산" fill="#6366f1" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Bar dataKey="totalEquity" name="자기자본" fill="#10b981" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Bar dataKey="cashAndEquivalents" name="현금·등가물" fill="#f59e0b" opacity={0.8} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center">
      <span className="text-zinc-600 text-sm">{label}</span>
    </div>
  );
}
