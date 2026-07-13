"use client";

import { useState } from "react";
import Link from "next/link";
import StockIdentity from "@/components/StockIdentity";
import {
  btnNeutral,
  btnPrimary,
  btnPrimaryOutline,
  categoryBadge,
  gradeBadge,
  inputClass,
  listRowChevron,
  marketBadge,
  panelInlineForm,
} from "@/lib/economist-ui";
import { EconomistAlert, EconomistPanel } from "@/components/EconomistPage";
import type { StockWithChecklist } from "@/app/research/screening/page";

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
    <EconomistPanel>
      <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-text-primary">관심종목 목록</h2>
          <p className="text-xs text-text-muted mt-0.5">
            클릭하여 체크리스트 확인 · {stocks.length}개 등록됨
          </p>
        </div>
        <button
          id="btn-toggle-add-form"
          type="button"
          onClick={() => {
            setShowAddForm((v) => !v);
            setAddError(null);
          }}
          className={`text-xs px-4 py-2 rounded-sm font-semibold transition-colors ${
            showAddForm ? btnNeutral : btnPrimary
          }`}
        >
          {showAddForm ? "✕ 닫기" : "+ 신규 종목 추가"}
        </button>
      </div>

      {showAddForm && (
        <div className={panelInlineForm}>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
            신규 종목 추가
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">종목코드 * (예: 005930)</label>
                <input
                  id="input-ticker"
                  value={form.ticker}
                  onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="005930 or AAPL"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">종목명 *</label>
                <input
                  id="input-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="삼성전자"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Yahoo Ticker</label>
                <input
                  id="input-yahoo-ticker"
                  value={form.yahooTicker}
                  onChange={(e) => setForm((f) => ({ ...f, yahooTicker: e.target.value }))}
                  placeholder="005930.KS or AAPL"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">DART Corp Code (KR)</label>
                <input
                  id="input-dart-code"
                  value={form.dartCorpCode}
                  onChange={(e) => setForm((f) => ({ ...f, dartCorpCode: e.target.value }))}
                  placeholder="00935720 (8자리)"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">SEC CIK (US)</label>
                <input
                  id="input-sec-cik"
                  value={form.secCik}
                  onChange={(e) => setForm((f) => ({ ...f, secCik: e.target.value }))}
                  placeholder="0000320193"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">브로커</label>
                <input
                  id="input-broker"
                  value={form.broker}
                  onChange={(e) => setForm((f) => ({ ...f, broker: e.target.value }))}
                  placeholder="대신증권"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">시장 *</label>
                <select
                  id="select-market"
                  value={form.market}
                  onChange={(e) => setForm((f) => ({ ...f, market: e.target.value }))}
                  className={inputClass}
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
                  className={inputClass}
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
                className={`${inputClass} resize-none`}
              />
            </div>

            {addError && <EconomistAlert variant="error">⚠️ {addError}</EconomistAlert>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs text-text-secondary bg-bg-elevated/50 hover:bg-bg-elevated rounded-sm transition-colors"
              >
                취소
              </button>
              <button
                id="btn-add-stock"
                type="button"
                onClick={handleAddStock}
                disabled={adding || !form.ticker || !form.name}
                className={`px-6 py-2 text-xs font-medium rounded-sm transition-colors disabled:opacity-50 ${btnPrimary}`}
              >
                {adding ? "추가 중..." : "종목 추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stocks.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <p className="text-text-secondary font-medium text-sm">추가된 종목이 없습니다</p>
          <p className="text-text-muted text-xs mt-1">위에서 새 종목을 추가하세요</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-default/60">
            {stocks.map((stock) => {
              const result = checkResults[stock.id];
              const isExpanded = expandedId === stock.id;
              const isChecking = checkingId === stock.id;

              const inactive = stock.isActive === 0;

              return (
                <li key={stock.id} className={inactive ? "opacity-50" : ""}>
                  <div
                    className="flex items-center gap-4 px-6 py-4 hover:bg-bg-elevated/30 transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedId((prev) => (prev === stock.id ? null : stock.id))
                    }
                  >
                    {/* 배지 */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-elevated border border-border-strong flex items-center justify-center text-sm font-bold text-text-primary">
                      {(stock.name || stock.ticker).slice(0, 1)}
                    </div>

                    <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <StockIdentity
                        name={stock.name}
                        ticker={stock.ticker}
                        href={`/stocks/${stock.ticker}`}
                        size="sm"
                        trailing={
                          <>
                            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${marketBadge[stock.market] ?? ""}`}>
                              {stock.market}
                            </span>
                            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${categoryBadge(stock.category)}`}>
                              {stock.category}
                            </span>
                            {inactive && (
                              <span className="text-[10px] bg-bg-elevated text-text-disabled px-1 py-0.5 rounded">
                                비활성
                              </span>
                            )}
                          </>
                        }
                      />
                      <p className="text-xs text-text-disabled mt-0.5 truncate">
                        추가일: {new Date(stock.addedAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>

                    {/* 그레이드 배지 */}
                    {result && (
                      <div className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${gradeBadge[result.summary.grade] ?? ""}`}>
                        {result.summary.grade}
                      </div>
                    )}

                    {/* 체크리스트 실행 버튼 */}
                    <button
                      id={`btn-checklist-${stock.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        runChecklist(stock.id);
                      }}
                      disabled={isChecking}
                      className={`shrink-0 text-xs px-3 py-1.5 rounded-sm border transition-colors whitespace-nowrap disabled:opacity-50 ${btnPrimaryOutline}`}
                    >
                      {isChecking ? "..." : "✓ 체크리스트"}
                    </button>

                    <span
                      className={listRowChevron}
                      style={{
                        transform: isExpanded && result ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    >
                      ▶
                    </span>
                  </div>

                  {isExpanded && result && (
                    <div className="px-6 py-5 bg-bg-base/50 border-t border-border-default/50">
                      {/* 요약 */}
                      <div className="flex items-center gap-4 mb-4 flex-wrap">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${gradeBadge[result.summary.grade] ?? ""}`}>
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
                            className={`flex items-start gap-3 p-3 rounded-sm border ${
                              item.pass === true
                                ? "bg-brand-green/5 border-brand-green/20"
                                : item.pass === false
                                ? "bg-loss-bg border-loss-border"
                                : "bg-bg-elevated/50 border-border-default"
                            }`}
                          >
                            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              item.pass === true
                                ? "bg-brand-green/15 text-brand-green"
                                : item.pass === false
                                ? "bg-loss-bg text-loss-400"
                                : "bg-bg-elevated text-text-muted"
                            }`}>
                              {item.pass === true ? "✓" : item.pass === false ? "✗" : "—"}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-text-secondary">{item.name}</p>
                              <p className={`text-xs mt-0.5 ${
                                item.pass === true ? "text-brand-green" :
                                item.pass === false ? "text-loss-400" : "text-text-muted"
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
    </EconomistPanel>
  );
}
