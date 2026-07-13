"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import JournalList from "./JournalList";
import {
  EconomistPanel,
  EconomistPanelBody,
  EconomistPanelHeader,
  EconomistStatGrid,
  EconomistTabBar,
} from "@/components/EconomistPage";
import { swsStatCard } from "@/lib/economist-ui";

const JournalAnalytics = dynamic(
  () => import("@/components/JournalAnalytics"),
  { ssr: false, loading: () => <AnalyticsLoading /> }
);

function AnalyticsLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`${swsStatCard} animate-pulse h-28`} />
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

const TABS = [
  { id: "list" as const, label: "일지 목록" },
  { id: "analytics" as const, label: "분석 대시보드" },
];
type TabId = (typeof TABS)[number]["id"];

export default function JournalTabs({
  rows,
  buyCount,
  sellCount,
}: {
  rows: JournalRow[];
  buyCount: number;
  sellCount: number;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("list");

  return (
    <div className="space-y-6">
      <EconomistStatGrid
        items={[
          { label: "전체 거래", value: rows.length },
          { label: "매수", value: buyCount, valueClassName: "text-profit-400" },
          { label: "매도", value: sellCount, valueClassName: "text-loss-400" },
          {
            label: "기타",
            value: rows.length - buyCount - sellCount,
          },
        ]}
      />

      <EconomistTabBar tabs={TABS} active={activeTab} onChange={setActiveTab} idPrefix="journal" />

      {activeTab === "list" && (
        <EconomistPanel>
          <EconomistPanelHeader
            title="매매 일지"
            subtitle="거래 기록을 확인하고 상세 페이지로 이동하세요"
          />
          <EconomistPanelBody className="p-0 sm:p-6 sm:pt-4">
            <JournalList rows={rows} />
          </EconomistPanelBody>
        </EconomistPanel>
      )}

      {activeTab === "analytics" && (
        <EconomistPanel>
          <EconomistPanelHeader title="분석 대시보드" subtitle="감정 태그 · 실현 손익 · 카테고리별 통계" />
          <EconomistPanelBody>
            <JournalAnalytics />
          </EconomistPanelBody>
        </EconomistPanel>
      )}
    </div>
  );
}
