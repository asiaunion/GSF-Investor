"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import JournalList from "./JournalList";

const JournalAnalytics = dynamic(
  () => import("@/components/JournalAnalytics"),
  { ssr: false, loading: () => <AnalyticsLoading /> }
);

function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-pulse h-28" />
      ))}
    </div>
  );
}

type JournalRow = {
  id: number;
  stockId: number | null;
  ticker: string | null;
  name: string | null;
  market: string | null;
  tradedAt: string;
  action: string;
  quantity: number;
  price: number;
  currency: string | null;
  thesis: string;
  emotionTag: string | null;
  createdAt: string | null;
};

const TABS = ["일지 목록", "분석 대시보드"] as const;
type Tab = (typeof TABS)[number];

export default function JournalTabs({ rows }: { rows: JournalRow[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("일지 목록");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-zinc-800 text-white border border-zinc-700 border-b-zinc-800 -mb-px"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "일지 목록" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <JournalList rows={rows} />
        </div>
      )}

      {activeTab === "분석 대시보드" && <JournalAnalytics />}
    </div>
  );
}
