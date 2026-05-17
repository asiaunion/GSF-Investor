"use client";

import { useState } from "react";
import Link from "next/link";
import type { StockWithChecklist } from "./page";

type ChecklistItem = {
  no: number;
  name: string;
  pass: boolean | null;
  value: string;
  threshold: string;
};

type ChecklistResult = {
  stockId: number;
  ticker: string;
  name: string;
  latestPrice: number | null;
  checklist: ChecklistItem[];
  summary: { passCount: number; totalChecks: number; grade: string };
  recentDisclosures: { title: string; filedAt: string }[];
};

type Props = {
  stocks: StockWithChecklist[];
};

const gradeColor: Record<string, string> = {
  A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  B: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  C: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  D: "text-red-400 bg-red-500/10 border-red-500/30",
};

const marketBadge: Record<string, string> = {
  KR: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  US: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

export default function DiscoverClient({ stocks: initialStocks }: Props) {
  const [stocks, setStocks] = useState(initialStocks);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<Record<number, ChecklistResult>>({});
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 신규 종목 폼 상태
  const [form, setForm] = useState({
    ticker: "",
    yahooTicker: "",
    dartCorpCode: "",
    secCik: "",
    name: "",
    market: "KR",
    category: "Core",
    broker: "",
    thesis: "",
  });

  const handleAddStock = async () => {
    if (!form.ticker || !form.name || !form.market) return;
    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/discover/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "추가 실패");
        return;
      }

      // 목록 갱신
      setStocks((prev) => [
        {
          id: data.stockId,
          ticker: data.ticker,
          name: form.name,
          market: form.market,
          category: form.category,
          isActive: 1,
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setShowAddForm(false);
      setForm({
        ticker: "", yahooTicker: "", dartCorpCode: "", secCik: "",
        name: "", market: "KR", category: "Core", broker: "", thesis: "",
      });

      // 즉시 체크리스트 실행
      runChecklist(data.stockId);
    } catch (err) {
      setAddError(String(err));
    } finally {
      setAdding(false);
    }
  };

  const runChecklist = async (stockId: number) => {
    setCheckingId(stockId);
    setExpandedId(stockId);
    try {
      const res = await fetch(`/api/discover/checklist?stockId=${stockId}`);
      const data: ChecklistResult = await res.json();
      if (res.ok) {
        setCheckResults((prev) => ({ ...prev, [stockId]: data }));
      }
    } catch {
      // 실패 무시
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── 신규 종목 추가 ──────────────────────────────────────────────── */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <span className="text-emerald-400">＋</span> 신규 종목 추가
          </h2>
          <button
            id="btn-toggle-add-form"
            onClick={() => setShowAddForm((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 border border-border-default rounded-lg"
          >
            {showAddForm ? "닫기" : "입력 폼 열기"}
          </button>
        </div>

        {showAddForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">종목코드 * (예: 005930)</label>
                <input
                  id="input-ticker"
                  value={form.ticker}
                  onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="005930 or AAPL"
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">종목명 *</label>
                <input
                  id="input-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="삼성전자"
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Yahoo Ticker</label>
                <input
                  id="input-yahoo-ticker"
                  value={form.yahooTicker}
                  onChange={(e) => setForm((f) => ({ ...f, yahooTicker: e.target.value }))}
                  placeholder="005930.KS or AAPL"
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">DART Corp Code (KR)</label>
                <input
                  id="input-dart-code"
                  value={form.dartCorpCode}
                  onChange={(e) => setForm((f) => ({ ...f, dartCorpCode: e.target.value }))}
                  placeholder="00935720 (8자리)"
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">SEC CIK (US)</label>
                <input
                  id="input-sec-cik"
                  value={form.secCik}
                  onChange={(e) => setForm((f) => ({ ...f, secCik: e.target.value }))}
                  placeholder="0000320193"
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">브로커</label>
                <input
                  id="input-broker"
                  value={form.broker}
                  onChange={(e) => setForm((f) => ({ ...f, broker: e.target.value }))}
                  placeholder="대신증권"
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">시장 *</label>
                <select
                  id="select-market"
                  value={form.market}
                  onChange={(e) => setForm((f) => ({ ...f, market: e.target.value }))}
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="KR">KR (한국)</option>
                  <option value="US">US (미국)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">카테고리</label>
                <select
                  id="select-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Core">Core</option>
                  <option value="Satellite">Satellite</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-text-secondary block mb-1">투자 테제</label>
              <textarea
                id="input-thesis"
                value={form.thesis}
                onChange={(e) => setForm((f) => ({ ...f, thesis: e.target.value }))}
                placeholder="왜 이 종목에 관심을 갖게 됐는가?"
                rows={2}
                className="w-full bg-bg-elevated border border-border-default text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            {addError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                ⚠️ {addError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                id="btn-add-stock"
                onClick={handleAddStock}
                disabled={adding || !form.ticker || !form.name}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-bg-elevated disabled:cursor-not-allowed text-text-primary text-sm font-semibold rounded-lg transition-colors"
              >
                {adding ? "추가 중..." : "종목 추가 + 체크리스트 실행"}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-bg-elevated hover:bg-bg-elevated text-text-secondary text-sm rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 관심종목 목록 + 체크리스트 ──────────────────────────────────── */}
      <div className="bg-bg-surface border border-border-default rounded-2xl">
        <div className="px-6 py-4 border-b border-border-default">
          <h2 className="text-base font-semibold text-text-primary">
            관심종목 목록 ({stocks.length}개)
          </h2>
          <p className="text-xs text-text-muted mt-0.5">종목을 클릭해 체크리스트를 실행하세요</p>
        </div>

        {stocks.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">
            <p className="text-3xl mb-3">🔍</p>
            <p>추가된 종목이 없습니다. 위에서 새 종목을 추가하세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border-default/60">
            {stocks.map((stock) => {
              const result = checkResults[stock.id];
              const isExpanded = expandedId === stock.id;
              const isChecking = checkingId === stock.id;

              return (
                <li key={stock.id} className="divide-y divide-border-default/40">
                  {/* 종목 헤더 행 */}
                  <div
                    className="flex items-center gap-4 px-6 py-4 hover:bg-bg-elevated/30 transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedId((prev) => (prev === stock.id ? null : stock.id))
                    }
                  >
                    {/* 배지 */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-elevated border border-border-default flex items-center justify-center text-xs font-bold text-text-secondary">
                      {stock.ticker.slice(0, 4)}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">{stock.name}</span>
                        <span className="text-xs text-text-muted">{stock.ticker}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${marketBadge[stock.market] ?? ""}`}>
                          {stock.market}
                        </span>
                        <span className="text-xs text-text-muted">{stock.category}</span>
                        {!stock.isActive && (
                          <span className="text-xs text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">비활성</span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        추가일: {new Date(stock.addedAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>

                    {/* 그레이드 배지 */}
                    {result && (
                      <div className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${gradeColor[result.summary.grade] ?? ""}`}>
                        {result.summary.grade}
                      </div>
                    )}

                    {/* 체크리스트 실행 버튼 */}
                    <button
                      id={`btn-checklist-${stock.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        runChecklist(stock.id);
                      }}
                      disabled={isChecking}
                      className="shrink-0 text-xs px-3 py-1.5 bg-bg-elevated hover:bg-bg-elevated disabled:opacity-50 text-text-secondary rounded-lg transition-colors border border-border-default whitespace-nowrap"
                    >
                      {isChecking ? (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                          검증 중
                        </span>
                      ) : (
                        "✓ 체크리스트"
                      )}
                    </button>

                    {/* 종목 상세 링크 */}
                    <Link
                      href={`/stocks/${stock.ticker}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-xs text-text-muted hover:text-violet-400 transition-colors"
                    >
                      →
                    </Link>
                  </div>

                  {/* 체크리스트 결과 (확장) */}
                  {isExpanded && result && (
                    <div className="px-6 py-5 bg-bg-base/50">
                      {/* 요약 */}
                      <div className="flex items-center gap-4 mb-4 flex-wrap">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${gradeColor[result.summary.grade] ?? ""}`}>
                          등급 {result.summary.grade} — {result.summary.passCount}/{result.summary.totalChecks} 통과
                        </div>
                        {result.latestPrice != null && (
                          <span className="text-sm text-text-secondary">
                            현재가: {result.latestPrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* 체크리스트 항목 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {result.checklist.map((item) => (
                          <div
                            key={item.no}
                            className={`flex items-start gap-3 p-3 rounded-xl border ${
                              item.pass === true
                                ? "bg-emerald-500/5 border-emerald-500/20"
                                : item.pass === false
                                ? "bg-red-500/5 border-red-500/20"
                                : "bg-bg-elevated/50 border-border-default"
                            }`}
                          >
                            {/* 아이콘 */}
                            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              item.pass === true
                                ? "bg-emerald-500/20 text-emerald-400"
                                : item.pass === false
                                ? "bg-red-500/20 text-red-400"
                                : "bg-bg-elevated text-text-muted"
                            }`}>
                              {item.pass === true ? "✓" : item.pass === false ? "✗" : "—"}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-text-secondary">{item.name}</p>
                              <p className={`text-xs mt-0.5 ${
                                item.pass === true ? "text-emerald-400" :
                                item.pass === false ? "text-red-400" : "text-text-muted"
                              }`}>
                                {item.value}
                              </p>
                              <p className="text-xs text-text-muted mt-0.5">기준: {item.threshold}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 최근 공시 */}
                      {result.recentDisclosures.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-text-secondary mb-2">최근 30일 공시</p>
                          <ul className="space-y-1">
                            {result.recentDisclosures.map((d, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-text-muted">
                                <span className="text-text-disabled">{d.filedAt}</span>
                                <span className="text-text-secondary truncate">{d.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
