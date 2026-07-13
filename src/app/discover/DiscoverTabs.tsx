"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import DiscoverClient from "./DiscoverClient";
import DiscoverScoreboard from "@/components/DiscoverScoreboard";
import DiscoverScreener from "@/components/DiscoverScreener";
import DiscoverCompare from "@/components/DiscoverCompare";
import { EconomistStatGrid, EconomistTabBar } from "@/components/EconomistPage";
import type { StockWithChecklist } from "@/app/research/screening/page";

const TABS = [
  { id: "list", label: "관심종목 목록" },
  { id: "screener", label: "스크리너" },
  { id: "scoreboard", label: "✦ AI 스코어보드" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DiscoverTabs({ stocks }: { stocks: StockWithChecklist[] }) {
  const searchParams = useSearchParams();
  const compareRaw = searchParams.get("compare")?.trim() ?? "";
  const compareTickers = compareRaw
    ? compareRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const [tab, setTab] = useState<TabId>("list");

  const krCount = stocks.filter((s) => s.market === "KR").length;
  const activeCount = stocks.filter((s) => s.isActive === 1).length;

  if (compareTickers.length > 0) {
    return (
      <div className="space-y-6">
        <DiscoverCompare tickers={compareTickers} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EconomistStatGrid
        items={[
          { label: "관심종목", value: stocks.length },
          { label: "활성", value: activeCount, valueClassName: "text-brand-green" },
          { label: "KR", value: krCount, valueClassName: "text-brand-blue" },
          { label: "US", value: stocks.length - krCount },
        ]}
      />

      <EconomistTabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        idPrefix="tab-discover"
      />

      {tab === "list" && <DiscoverClient stocks={stocks} />}
      {tab === "screener" && <DiscoverScreener />}
      {tab === "scoreboard" && <DiscoverScoreboard />}
    </div>
  );
}
