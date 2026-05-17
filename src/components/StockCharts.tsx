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
  const color = isUp ? "var(--color-brand-green)" : "var(--color-brand-red)";

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
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
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
          contentStyle={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-text-primary)",
          }}
          formatter={(v) =>
            typeof v === "number"
              ? currency === "USD"
                ? [`$${v.toFixed(2)}`, "종가"]
                : [`₩${v.toLocaleString("ko-KR")}`, "종가"]
              : [String(v ?? "—"), "종가"]
          }
          labelStyle={{ color: "var(--color-text-secondary)" }}
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
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtAmt(v, currency)}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-text-primary)",
          }}
          formatter={(v, name) => [fmtAmt(typeof v === 'number' ? v : null, currency), String(name)]}
          labelStyle={{ color: "var(--color-text-secondary)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--color-text-muted)", paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="매출"
          stroke="var(--color-brand-blue)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-brand-blue)" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="opIncome"
          name="영업이익"
          stroke="var(--color-brand-green)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-brand-green)" }}
          activeDot={{ r: 5 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="netIncome"
          name="순이익"
          stroke="var(--color-warn-500)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-warn-500)" }}
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
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-default)" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtAmt(v, currency)}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-text-primary)",
          }}
          formatter={(v, name) => [fmtAmt(typeof v === 'number' ? v : null, currency), String(name)]}
          labelStyle={{ color: "var(--color-text-secondary)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--color-text-muted)", paddingTop: 8 }}
        />
        <Bar dataKey="totalAssets" name="총자산" fill="var(--color-brand-blue)" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Bar dataKey="totalEquity" name="자기자본" fill="var(--color-brand-green)" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Bar dataKey="cashAndEquivalents" name="현금·등가물" fill="var(--color-warn-500)" opacity={0.8} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center">
      <span className="text-[var(--color-text-disabled)] text-sm">{label}</span>
    </div>
  );
}
