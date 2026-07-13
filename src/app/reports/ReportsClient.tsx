"use client";

import { useState, useRef, useEffect } from "react";
import StockIdentity from "@/components/StockIdentity";
import {
  btnPrimary,
  swsCard,
  inputClass,
  linkMuted,
} from "@/lib/economist-ui";
import {
  EconomistAlert,
  EconomistPanel,
  EconomistPanelBody,
  EconomistPanelHeader,
  EconomistStatGrid,
} from "@/components/EconomistPage";
export type ReportRow = {
  id: number;
  stockId: number;
  ticker: string;
  stockName: string;
  trigger: string;
  generatedAt: string;
  preview: string;
};

export type StockOption = {
  id: number;
  ticker: string;
  name: string;
};

/**
 * 보고서 마크다운에서 "## 1. 요약" 섹션을 추출하여 줄 배열로 반환.
 * 실패 시 null.
 */
function extractSummaryLines(markdown: string): string[] | null {
  // ## 1. 요약 (3줄) 또는 ## 1. 요약 등 유연하게 매칭
  const match = markdown.match(/##\s*1\.\s*요약[^\n]*\n([\s\S]*?)(?=\n##\s*\d|$)/);
  if (!match) return null;

  const raw = match[1];
  const lines = raw
    .split("\n")
    .map((l) =>
      l
        .replace(/^[-*]\s+/, "")          // 리스트 기호 제거
        .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → 텍스트
        .replace(/\*([^*]+)\*/g, "$1")    // *italic* → 텍스트
        .replace(/^#+\s*/, "")            // 남은 # 제거
        .trim()
    )
    .filter(Boolean)
    .slice(0, 4); // 최대 4줄

  return lines.length ? lines : null;
}

type Props = {
  reports: ReportRow[];
  stocks: StockOption[];
};

const triggerLabel: Record<string, string> = {
  MANUAL: "수동 생성",
  SIGNAL_AUTO: "시그널 자동",
};

/** 보고서 1건 — 아코디언 */
function ReportAccordion({ report }: { report: ReportRow & { fullContent?: string } }) {
  const [open, setOpen] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(report.fullContent ?? null);
  const [loading, setLoading] = useState(false);

  // 요약 3줄 파싱
  const summaryLines = extractSummaryLines(report.preview);

  const handleToggle = async () => {
    if (!open && fullContent === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/${report.id}`);
        if (res.ok) {
          const data = await res.json();
          setFullContent(data.content_md ?? "");
        }
      } catch {
        setFullContent("보고서 전문을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    setOpen((prev) => !prev);
  };

  return (
    <li className="border-b border-[var(--color-border-default)]/60 last:border-0">
      {/* 헤더 행 */}
      <div className="flex items-start gap-4 px-6 py-4">
        {/* 종목 배지 */}
        <div className="shrink-0 w-10 h-10 rounded-sm bg-brand-green/10 border border-brand-green/25 flex items-center justify-center text-brand-green text-sm font-bold">
          {(report.stockName || report.ticker).slice(0, 1)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StockIdentity
              name={report.stockName}
              ticker={report.ticker}
              href={`/stocks/${report.ticker}`}
              size="sm"
            />
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                report.trigger === "SIGNAL_AUTO"
                  ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/25"
                  : "bg-brand-green/10 text-brand-green border border-brand-green/25"
              }`}
            >
              {triggerLabel[report.trigger] ?? report.trigger}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {new Date(report.generatedAt + "Z").toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </p>
          {/* 요약 3줄 */}
          {summaryLines ? (
            <ul className="mt-2 space-y-0.5">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-primary)] leading-relaxed">
                  <span className="text-brand-green mt-0.5 shrink-0 text-[10px]">▸</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
              {report.preview.replace(/#+\s*/g, "").replace(/\*\*/g, "").slice(0, 150)}...
            </p>
          )}
        </div>

        {/* 토글 버튼 */}
        <button
          onClick={handleToggle}
          className={`shrink-0 mt-1 flex items-center gap-1 text-xs px-2 py-1 rounded-sm whitespace-nowrap ${linkMuted} hover:bg-brand-green/10`}
        >
          {loading ? (
            <span className="w-3 h-3 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin inline-block" />
          ) : (
            <span
              className="inline-block transition-transform duration-200"
              style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
          )}
          {open ? "접기" : "전문 보기"}
        </button>
      </div>

      {/* 전문 패널 */}
      {open && (
        <div className="px-6 pb-5 pt-0">
          <div className={`${swsCard} p-4 max-h-[600px] overflow-y-auto`}>
            <pre
              className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed"
              
            >
              {fullContent ?? ""}
            </pre>
          </div>
        </div>
      )}
    </li>
  );
}

export default function ReportsClient({ reports: initialReports, stocks }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [selectedStockId, setSelectedStockId] = useState<number>(stocks[0]?.id ?? 0);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleGenerate = async () => {
    if (!selectedStockId || generating) return;
    setGenerating(true);
    setStreamText("");
    setStreamDone(false);
    setError(null);

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId: selectedStockId, trigger: "MANUAL" }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "알 수 없는 오류");
        setGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("스트림 읽기 실패");
        setGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setStreamText((prev) => prev + parsed.text);
              }
              if (parsed.done) {
                setStreamDone(true);
                if (parsed.saved) {
                  const listRes = await fetch("/api/reports");
                  if (listRes.ok) {
                    const data = await listRes.json();
                    setReports(data.reports);
                  }
                }
              }
            } catch {
              // 파싱 무시
            }
          }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  const selectedStock = stocks.find((s) => s.id === selectedStockId);

  const signalAutoCount = reports.filter((r) => r.trigger === "SIGNAL_AUTO").length;

  return (
    <div className="space-y-6">
      <EconomistStatGrid
        items={[
          { label: "저장된 보고서", value: reports.length },
          { label: "시그널 자동", value: signalAutoCount, valueClassName: "text-brand-blue" },
          { label: "수동 생성", value: reports.length - signalAutoCount },
          { label: "등록 종목", value: stocks.length },
        ]}
      />

      <EconomistPanel>
        <EconomistPanelHeader
          title="새 보고서 생성"
          subtitle="Gemini 2.5 Flash · 스트리밍 생성 후 자동 저장"
          trailing={<span className="text-brand-green text-sm font-semibold">✦</span>}
        />
        <EconomistPanelBody>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            id="select-stock-report"
            value={selectedStockId}
            onChange={(e) => setSelectedStockId(Number(e.target.value))}
            className={`flex-1 ${inputClass}`}
            disabled={generating}
          >
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ticker} — {s.name}
              </option>
            ))}
          </select>

          <button
            id="btn-generate-report"
            onClick={handleGenerate}
            disabled={generating || !selectedStockId}
            className={`px-5 py-2 text-sm font-semibold rounded-sm transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${btnPrimary}`}
          >
            {generating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                AI 분석 중...
              </>
            ) : (
              <>✦ AI 분석 보고서 생성</>
            )}
          </button>
        </div>

        {/* 스트리밍 결과 */}
        {(streamText || generating) && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {selectedStock?.name} ({selectedStock?.ticker}) — Gemini 2.5 Flash
              </span>
              {streamDone && (
                <span className="text-xs text-[var(--color-brand-green)] font-medium">✓ 저장 완료</span>
              )}
            </div>
            <div
              ref={streamRef}
              className={`${swsCard} p-4 max-h-[520px] overflow-y-auto`}
            >
              <pre
                className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed"
                
              >
                {streamText}
                {generating && !streamDone && (
                  <span className="inline-block w-2 h-4 bg-brand-green ml-0.5 animate-pulse align-middle" />
                )}
              </pre>
            </div>
          </div>
        )}

        {error && <EconomistAlert variant="error">⚠️ {error}</EconomistAlert>}
        </EconomistPanelBody>
      </EconomistPanel>

      <EconomistPanel>
        <EconomistPanelHeader
          title={`저장된 보고서 (${reports.length}건)`}
          subtitle="▶ 전문 보기 클릭으로 펼치기"
        />

        {reports.length === 0 ? (
          <EconomistPanelBody className="py-16 text-center">
            <p className="text-text-secondary font-medium text-sm">아직 생성된 보고서가 없습니다</p>
            <p className="text-text-muted text-xs mt-1">위에서 종목을 선택하고 AI 분석을 시작하세요</p>
          </EconomistPanelBody>
        ) : (
          <ul>
            {reports.map((report) => (
              <ReportAccordion key={report.id} report={report} />
            ))}
          </ul>
        )}
      </EconomistPanel>
    </div>
  );
}
