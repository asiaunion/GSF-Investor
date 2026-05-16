"use client";

import { useState } from "react";
import DiscoverClient from "./DiscoverClient";
import DiscoverScoreboard from "@/components/DiscoverScoreboard";
import type { StockWithChecklist } from "./page";

const TABS = [
  { id: "list", label: "관심종목 목록" },
  { id: "scoreboard", label: "✦ AI 스코어보드" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DiscoverTabs({ stocks }: { stocks: StockWithChecklist[] }) {
  const [tab, setTab] = useState<TabId>("list");

  return (
    <div className="space-y-6">
      {/* 탭 선택 */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-discover-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 패널 */}
      {tab === "list" && <DiscoverClient stocks={stocks} />}
      {tab === "scoreboard" && <DiscoverScoreboard />}
    </div>
  );
}
