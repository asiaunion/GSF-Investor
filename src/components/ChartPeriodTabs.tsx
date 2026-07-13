"use client";

import { tabActive, tabInactive } from "@/lib/economist-ui";

export const CHART_PERIODS = ["7D", "1M", "3M", "YTD", "1Y", "ALL"] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

export function ChartPeriodTabs({
  value,
  onChange,
  idPrefix = "period",
}: {
  value: ChartPeriod;
  onChange: (p: ChartPeriod) => void;
  idPrefix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {CHART_PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          id={`${idPrefix}-${p}`}
          onClick={() => onChange(p)}
          className={`px-2 py-0.5 rounded-sm text-[11px] font-semibold transition-colors ${
            value === p ? tabActive : tabInactive
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
