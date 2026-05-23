"use client";

import { useState, useMemo } from "react";
import { inputClass, tabActive, tabInactive } from "@/lib/economist-ui";
import {
  EconomistEmptyState,
  EconomistFilterRow,
  EconomistPanel,
  EconomistPanelBody,
  EconomistPanelHeader,
  EconomistStatGrid,
} from "@/components/EconomistPage";
import StockIdentity from "@/components/StockIdentity";
import { economistCard } from "@/lib/economist-ui";
import type { DisclosureRow } from "./page";

interface Props {
  disclosures: DisclosureRow[];
  tickers: string[];
}

export default function DisclosuresClient({ disclosures, tickers }: Props) {
  const [filterTicker, setFilterTicker] = useState<string>("ALL");
  const [filterSource, setFilterSource] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return disclosures.filter((d) => {
      if (filterTicker !== "ALL" && d.ticker !== filterTicker) return false;
      if (filterSource !== "ALL" && d.source !== filterSource) return false;
      return true;
    });
  }, [disclosures, filterTicker, filterSource]);

  const dartCount = disclosures.filter((d) => d.source === "DART").length;
  const secCount = disclosures.filter((d) => d.source === "SEC").length;

  return (
    <div className="space-y-6">
      <EconomistStatGrid
        items={[
          { label: "전체 공시", value: disclosures.length },
          { label: "DART", value: dartCount, valueClassName: "text-brand-blue" },
          { label: "SEC", value: secCount, valueClassName: "text-brand-green" },
          { label: "표시 중", value: filtered.length },
        ]}
      />

      <EconomistFilterRow countLabel={`${filtered.length}건`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted shrink-0">종목</span>
          <select
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className={`${inputClass} w-auto min-w-[120px]`}
          >
            <option value="ALL">전체</option>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted shrink-0">소스</span>
          <div className="flex gap-1">
            {["ALL", "DART", "SEC"].map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setFilterSource(src)}
                className={`px-3 py-1.5 rounded-sm text-xs transition-all ${
                  filterSource === src ? tabActive : tabInactive
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </EconomistFilterRow>

      {filtered.length === 0 ? (
        <EconomistEmptyState
          title="표시할 공시가 없습니다"
          description="필터를 변경하거나 daily_dart.py 실행 후 다시 확인하세요"
        />
      ) : (
        <EconomistPanel>
          <EconomistPanelHeader title="공시 목록" subtitle="클릭하여 AI 요약 펼치기" />
          <EconomistPanelBody className="space-y-2 py-4">
            {filtered.map((d) => (
              <DisclosureCard key={d.id} disclosure={d} />
            ))}
          </EconomistPanelBody>
        </EconomistPanel>
      )}
    </div>
  );
}

function DisclosureCard({ disclosure: d }: { disclosure: DisclosureRow }) {
  const [expanded, setExpanded] = useState(false);

  const sourceColor =
    d.source === "DART"
      ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/25"
      : "bg-brand-green/10 text-brand-green border border-brand-green/25";

  const marketFlag = d.market === "KR" ? "🇰🇷" : d.market === "US" ? "🇺🇸" : "🌏";

  const filedLabel = d.filedAt ? d.filedAt.slice(0, 10) : "—";

  return (
    <div className={`${economistCard} overflow-hidden hover:border-brand-green/30 transition-colors`}>
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <StockIdentity name={d.stockName} ticker={d.ticker} href={`/stocks/${d.ticker}`} size="sm" />
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${sourceColor}`}>
                {d.source}
              </span>
              <span className="text-xs text-text-muted">{marketFlag}</span>
              <span className="text-xs text-text-muted ml-auto">{filedLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-left w-full group"
            >
              <p className="text-sm text-text-primary leading-snug group-hover:text-brand-green transition-colors">
                {d.title}
              </p>
            </button>

            {expanded && d.summaryAi && (
              <div className="text-xs text-text-secondary leading-relaxed bg-bg-elevated/50 rounded-sm p-3 mt-3 border border-border-default/60">
                {d.summaryAi}
              </div>
            )}

            {expanded && d.rawUrl && (
              <a
                href={d.rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-brand-green hover:text-brand-green/80"
              >
                원문 보기 →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
