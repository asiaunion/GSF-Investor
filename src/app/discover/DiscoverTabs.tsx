"use client";

import { useState } from "react";
import DiscoverClient from "./DiscoverClient";
import DiscoverScoreboard from "@/components/DiscoverScoreboard";
import { EconomistStatGrid, EconomistTabBar } from "@/components/EconomistPage";
import type { StockWithChecklist } from "./page";

const TABS = [
  { id: "list", label: "관심종목 목록" },
  { id: "scoreboard", label: "✦ AI 스코어보드" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DiscoverTabs({ stocks }: { stocks: StockWithChecklist[] }) {
  const [tab, setTab] = useState<TabId>("list");

  const krCount = stocks.filter((s) => s.market === "KR").length;
  const activeCount = stocks.filter((s) => s.isActive === 1).length;

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

      {/* 패널 */}
      {tab === "list" && <DiscoverClient stocks={stocks} />}
      {tab === "scoreboard" && <DiscoverScoreboard />}
    </div>
  );
}
