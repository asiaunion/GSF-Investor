"use client";

import { ReturnBarChart, formatKRW } from "@/components/DashboardCharts";

export interface HoldingRow {
  ticker: string;
  name: string;
  market: string;
  quantity: number;
  avgPrice: number | null;
  currentPrice: number | null;
  currency: string;
}

export default function ReturnsClient({ holdings }: { holdings: HoldingRow[] }) {

  // ReturnBarData interface: { ticker: string; name: string; returnRate: number }
  const chartData = holdings
    .filter((h) => h.avgPrice && h.currentPrice)
    .map((h) => ({
      ticker: h.ticker,
      name: h.name,
      returnRate: ((h.currentPrice! - h.avgPrice!) / h.avgPrice!) * 100,
    }))
    .sort((a, b) => b.returnRate - a.returnRate);

  if (chartData.length === 0) {
    return <p className="text-text-muted text-sm">데이터 없음</p>;
  }

  return (
    <div className="space-y-6">
      <ReturnBarChart data={chartData} compact={false} />
    </div>
  );
}
