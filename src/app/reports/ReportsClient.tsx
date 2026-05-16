"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { ReportRow, StockOption } from "./page";

type Props = {
  reports: ReportRow[];
  stocks: StockOption[];
};

const triggerLabel: Record<string, string> = {
  MANUAL: "수동 생성",
  SIGNAL_AUTO: "시그널 자동",
};

export default function ReportsClient({ reports: initialReports, stocks }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [selectedStockId, setSelectedStockId] = useState<number>(stocks[0]?.id ?? 0);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  // 스트림 영역 자동 스크롤
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
                  // 보고서 목록 갱신
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-violet-400">✦</span> 새 보고서 생성
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            id="select-stock-report"
            value={selectedStockId}
            onChange={(e) => setSelectedStockId(Number(e.target.value))}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
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
              <span className="text-xs text-zinc-400">
                {selectedStock?.name} ({selectedStock?.ticker}) — Gemini 2.0 Flash
              </span>
              {streamDone && (
                <span className="text-xs text-emerald-400 font-medium">✓ 저장 완료</span>
              )}
            </div>
            <div
              ref={streamRef}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 max-h-[520px] overflow-y-auto"
            >
              <pre
                className="text-sm text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed"
                style={{ fontFamily: "'Noto Sans KR', monospace" }}
              >
                {streamText}
                {generating && !streamDone && (
                  <span className="inline-block w-2 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
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

      {/* ── 보고서 목록 ──────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            저장된 보고서 ({reports.length}건)
          </h2>
        </div>

        {reports.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-sm">
            <p className="text-3xl mb-3">📋</p>
            <p>아직 생성된 보고서가 없습니다.</p>
            <p className="mt-1 text-xs">위에서 종목을 선택하고 AI 분석을 시작하세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/reports/${report.id}`}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-zinc-800/40 transition-colors group"
                >
                  {/* 종목 배지 */}
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-bold">
                    {report.ticker.slice(0, 4)}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        {report.stockName}
                      </span>
                      <span className="text-xs text-zinc-500">{report.ticker}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        report.trigger === "SIGNAL_AUTO"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                      }`}>
                        {triggerLabel[report.trigger] ?? report.trigger}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {new Date(report.generatedAt + "Z").toLocaleString("ko-KR", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                        hour12: false
                      })}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {report.preview.replace(/#+\s/g, "").slice(0, 150)}...
                    </p>
                  </div>

                  {/* 화살표 */}
                  <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
