"use client";

import { useState, useMemo } from "react";
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

  return (
    <div className="space-y-5">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">종목</span>
          <select
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className="bg-bg-surface border border-border-default text-text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="ALL">전체</option>
            {tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">소스</span>
          <div className="flex gap-1">
            {["ALL", "DART", "SEC"].map((src) => (
              <button
                key={src}
                onClick={() => setFilterSource(src)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterSource === src
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-bg-surface text-text-secondary border border-border-default hover:border-zinc-500"
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>

        <span className="ml-auto text-xs text-text-muted">
          {filtered.length}건
        </span>
      </div>

      {/* 공시 리스트 */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DisclosureCard key={d.id} disclosure={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DisclosureCard({ disclosure: d }: { disclosure: DisclosureRow }) {
  const [expanded, setExpanded] = useState(false);

  const sourceColor =
    d.source === "DART"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
      : "bg-amber-500/10 text-amber-400 border-amber-500/30";

  const marketBadge =
    d.market === "KR"
      ? "🇰🇷"
      : d.market === "US"
      ? "🇺🇸"
      : "🌏";

  // 날짜 표시
  const filedLabel = d.filedAt
    ? d.filedAt.slice(0, 10)
    : "—";

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-border-default transition-colors">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* 소스 배지 */}
          <span
            className={`mt-0.5 shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${sourceColor}`}
          >
            {d.source}
          </span>

          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-text-muted">{marketBadge}</span>
              <span className="text-xs font-semibold text-text-secondary">
                {d.ticker}
              </span>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted">{filedLabel}</span>
            </div>

            <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2">
              {d.title}
            </p>

            {/* AI 요약 */}
            {d.summaryAi && (
              <div className="mt-2">
                {expanded ? (
                  <div className="text-xs text-text-secondary leading-relaxed bg-bg-elevated/50 rounded-lg p-3 mt-1">
                    {d.summaryAi}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted line-clamp-1">
                    AI: {d.summaryAi}
                  </p>
                )}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  {expanded ? "접기 ↑" : "AI 요약 보기 ↓"}
                </button>
              </div>
            )}
          </div>

          {/* 원문 링크 */}
          {d.rawUrl && (
            <a
              href={d.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 mt-0.5 text-xs text-text-muted hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              원문
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-bg-surface border border-border-default rounded-2xl px-8 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center mx-auto mb-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#71717a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <p className="text-text-secondary font-medium text-sm">수집된 공시가 없습니다</p>
      <p className="text-text-muted text-xs mt-1">
        daily_dart.py / daily_sec.py 크론잡을 확인하세요
      </p>
    </div>
  );
}
