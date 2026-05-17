"use client";

import { useState, useRef, useEffect } from "react";
import type { ReportRow, StockOption } from "./page";

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
        <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
          {report.ticker.slice(0, 4)}
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{report.stockName}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{report.ticker}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                report.trigger === "SIGNAL_AUTO"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
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
                  <span className="text-emerald-500 mt-0.5 shrink-0 text-[10px]">▸</span>
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
          className="shrink-0 mt-1 flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded-md hover:bg-emerald-500/10 whitespace-nowrap"
        >
          {loading ? (
            <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin inline-block" />
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
          <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-4 max-h-[600px] overflow-y-auto">
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

  return (
    <div className="space-y-6">
      {/* ── 보고서 생성 카드 ──────────────────────────────────────────────── */}
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-6">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <span className="text-emerald-400">✦</span> 새 보고서 생성
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            id="select-stock-report"
            value={selectedStockId}
            onChange={(e) => setSelectedStockId(Number(e.target.value))}
            className="flex-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-[var(--color-bg-elevated)] disabled:cursor-not-allowed text-text-primary text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
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
              className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm p-4 max-h-[520px] overflow-y-auto"
            >
              <pre
                className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed"
                
              >
                {streamText}
                {generating && !streamDone && (
                  <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
                )}
              </pre>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── 보고서 목록 (아코디언) ─────────────────────────────────────────── */}
      <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--color-border-default)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            저장된 보고서 ({reports.length}건)
          </h2>
          <span className="text-xs text-[var(--color-text-muted)]">▶ 전문 보기 클릭으로 펼치기</span>
        </div>

        {reports.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-text-muted)] text-sm">
            <p className="text-3xl mb-3">📋</p>
            <p>아직 생성된 보고서가 없습니다.</p>
            <p className="mt-1 text-xs">위에서 종목을 선택하고 AI 분석을 시작하세요.</p>
          </div>
        ) : (
          <ul>
            {reports.map((report) => (
              <ReportAccordion key={report.id} report={report} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
