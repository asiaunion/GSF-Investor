"use client";

import { useState } from "react";
import type { StockSetting, LoanSetting } from "./page";

type Props = {
  stocks: StockSetting[];
  loans: LoanSetting[];
};

const categoryOptions = ["Core", "Satellite"];
const marketBadge: Record<string, string> = {
  KR: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  US: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

export default function SettingsClient({ stocks: initialStocks, loans: initialLoans }: Props) {
  const [stocks, setStocks] = useState(initialStocks);
  const [loans, setLoans] = useState(initialLoans);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockSetting> | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 신규 대출 추가 ──────────────────────────────────────────────────────────
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanForm, setLoanForm] = useState({
    label: "주식담보대출",
    loanAmount: "",
    interestRate: "",
    startedAt: "",
    note: "",
  });
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  // ── 신규 종목 추가 ──────────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    ticker: "",
    name: "",
    market: "KR",
    category: "Core",
    sector: "",
    yahooTicker: "",
    dartCorpCode: "",
    secCik: "",
    broker: "",
    thesis: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const handleExpand = (stock: StockSetting) => {
    if (expandedId === stock.id) {
      setExpandedId(null);
      setEditForm(null);
      setSaveError(null);
    } else {
      setExpandedId(stock.id);
      setEditForm(stock);
      setSaveError(null);
    }
  };

  const handleSaveForm = async () => {
    if (!editForm || !expandedId) return;
    setSaving(true);
    setSaveError(null);

    try {
      const updates = {
        broker: editForm.broker,
        thesis: editForm.thesis,
        category: editForm.category,
        sector: editForm.sector,
        yahoo_ticker: editForm.yahooTicker,
        dart_corp_code: editForm.dartCorpCode,
        sec_cik: editForm.secCik,
      };

      const res = await fetch("/api/settings/stocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expandedId, updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "저장 실패");
        return;
      }
      // Update local state
      setStocks((prev) =>
        prev.map((s) => (s.id === expandedId ? { ...s, ...editForm } : s))
      );
      setExpandedId(null);
      setEditForm(null);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (stock: StockSetting) => {
    setTogglingId(stock.id);
    try {
      const res = await fetch("/api/settings/stocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stock.id, isActive: stock.isActive === 0 }),
      });
      if (res.ok) {
        setStocks((prev) =>
          prev.map((s) =>
            s.id === stock.id ? { ...s, isActive: s.isActive === 1 ? 0 : 1 } : s
          )
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = stocks.filter((s) => s.isActive === 1).length;
  const inactiveCount = stocks.filter((s) => s.isActive === 0).length;

  const handleAddStock = async () => {
    setAddSaving(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch("/api/discover/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: addForm.ticker.trim().toUpperCase(),
          name: addForm.name.trim(),
          market: addForm.market,
          category: addForm.category,
          sector: addForm.sector.trim() || null,
          yahooTicker: addForm.yahooTicker.trim() || null,
          dartCorpCode: addForm.dartCorpCode.trim() || null,
          secCik: addForm.secCik.trim() || null,
          broker: addForm.broker.trim() || null,
          thesis: addForm.thesis.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "추가 실패");
        return;
      }
      setAddSuccess(`✅ ${addForm.name}(${addForm.ticker.toUpperCase()}) 추가 완료! 다음 daily_price.py 실행 시 주가가 수집됩니다.`);
      setAddForm({ ticker: "", name: "", market: "KR", category: "Core", sector: "", yahooTicker: "", dartCorpCode: "", secCik: "", broker: "", thesis: "" });
      setShowAddForm(false);
      // 목록에 즉시 반영
      window.location.reload();
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAddSaving(false);
    }
  };

  // ── 대출 추가 핸들러 ────────────────────────────────────────────────────────
  const handleAddLoan = async () => {
    if (!loanForm.loanAmount || !loanForm.interestRate) {
      setLoanError("대출금액과 이자율은 필수입니다");
      return;
    }
    setLoanSaving(true);
    setLoanError(null);
    try {
      const res = await fetch("/api/settings/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: loanForm.label,
          loanAmount: parseFloat(loanForm.loanAmount),
          interestRate: parseFloat(loanForm.interestRate),
          startedAt: loanForm.startedAt || null,
          note: loanForm.note || null,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      setLoanForm({ label: "주식담보대출", loanAmount: "", interestRate: "", startedAt: "", note: "" });
      setShowLoanForm(false);
      window.location.reload();
    } catch (e) {
      setLoanError(String(e));
    } finally {
      setLoanSaving(false);
    }
  };

  const handleDeleteLoan = async (id: number) => {
    if (!confirm("이 대출 항목을 삭제하시겠습니까?")) return;
    await fetch("/api/settings/loans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLoans((prev) => prev.filter((l) => l.id !== id));
  };

  const handleToggleLoan = async (loan: LoanSetting) => {
    await fetch("/api/settings/loans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: loan.id, isActive: loan.isActive === 0 }),
    });
    setLoans((prev) => prev.map((l) => l.id === loan.id ? { ...l, isActive: l.isActive === 1 ? 0 : 1 } : l));
  };

  return (
    <div className="space-y-6">
      {/* ── 통계 요약 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "전체 종목", value: stocks.length, color: "text-white" },
          { label: "활성", value: activeCount, color: "text-emerald-400" },
          { label: "비활성", value: inactiveCount, color: "text-zinc-500" },
          {
            label: "Core / Satellite",
            value: `${stocks.filter((s) => s.category === "Core" && s.isActive).length} / ${stocks.filter((s) => s.category === "Satellite" && s.isActive).length}`,
            color: "text-violet-400",
          },
        ].map((item) => (
          <div key={item.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── 오류 메시지 ────────────────────────────────────────────── */}
      {saveError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          ⚠️ {saveError}
        </div>
      )}

      {/* ── 종목 목록 ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">관심종목 관리</h2>
            <p className="text-xs text-zinc-500 mt-0.5">클릭하여 상세 정보 확인 및 편집</p>
          </div>
          <button
            id="btn-add-stock"
            onClick={() => { setShowAddForm((v) => !v); setAddError(null); setAddSuccess(null); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              showAddForm
                ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                : "bg-violet-600/10 border-violet-500/30 text-violet-400 hover:bg-violet-600/20"
            }`}
          >
            {showAddForm ? "✕ 닫기" : "+ 신규 종목 추가"}
          </button>
        </div>

        {/* ── 신규 종목 추가 폼 ── */}
        {showAddForm && (
          <div className="px-6 py-5 bg-zinc-950/60 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">신규 종목 추가</h3>

            {addError && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                ⚠️ {addError}
              </div>
            )}
            {addSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                {addSuccess}
              </div>
            )}

            {/* 필수 필드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">티커 <span className="text-red-400">*</span></label>
                <input
                  id="input-add-ticker"
                  value={addForm.ticker}
                  onChange={(e) => setAddForm({ ...addForm, ticker: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 uppercase"
                  placeholder="069500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">종목명 <span className="text-red-400">*</span></label>
                <input
                  id="input-add-name"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="KODEX 200"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Yahoo Ticker</label>
                <input
                  id="input-add-yahoo"
                  value={addForm.yahooTicker}
                  onChange={(e) => setAddForm({ ...addForm, yahooTicker: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="069500.KS"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">시장 <span className="text-red-400">*</span></label>
                <select
                  id="select-add-market"
                  value={addForm.market}
                  onChange={(e) => setAddForm({ ...addForm, market: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  <option value="KR">KR (국내)</option>
                  <option value="US">US (미국)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">카테고리</label>
                <select
                  id="select-add-category"
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  <option value="Core">Core</option>
                  <option value="Satellite">Satellite</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">섹터</label>
                <input
                  value={addForm.sector}
                  onChange={(e) => setAddForm({ ...addForm, sector: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  placeholder="Food & Beverage"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">브로커</label>
                <input
                  value={addForm.broker}
                  onChange={(e) => setAddForm({ ...addForm, broker: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  placeholder="대신증권"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-xs text-zinc-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                id="btn-submit-add-stock"
                onClick={handleAddStock}
                disabled={addSaving || !addForm.ticker || !addForm.name}
                className="px-6 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {addSaving ? "추가 중..." : "종목 추가"}
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-zinc-800/60">
          {stocks.map((stock) => {
            const isExpanded = expandedId === stock.id;
            const isToggling = togglingId === stock.id;
            const inactive = stock.isActive === 0;

            return (
              <li key={stock.id} className={inactive ? "opacity-50" : ""}>
                {/* 헤더 행 */}
                <div
                  className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => handleExpand(stock)}
                >
                  {/* 배지 */}
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                    {stock.ticker.slice(0, 4)}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{stock.name}</span>
                      <span className="text-xs text-zinc-500">{stock.ticker}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${marketBadge[stock.market] ?? ""}`}>
                        {stock.market}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        stock.category === "Core"
                          ? "bg-violet-500/10 text-violet-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {stock.category}
                      </span>
                      {inactive && (
                        <span className="text-xs bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">비활성</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate">
                      {stock.thesis || "테제 미입력"}
                    </p>
                  </div>

                  {/* 활성/비활성 토글 */}
                  <button
                    id={`btn-toggle-${stock.id}`}
                    onClick={(e) => { e.stopPropagation(); toggleActive(stock); }}
                    disabled={isToggling}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      inactive
                        ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                    }`}
                  >
                    {isToggling ? "..." : inactive ? "활성화" : "비활성화"}
                  </button>

                  {/* 펼침 화살표 */}
                  <span className="text-zinc-600 text-xs transition-transform duration-200"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                    ▶
                  </span>
                </div>

                {/* 상세 편집 패널 */}
                {isExpanded && editForm && (
                  <div className="px-6 py-5 bg-zinc-950/50 border-t border-zinc-800/50 space-y-4">
                    {/* 식별자 그리드 */}
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                        데이터 소스 식별자
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">Yahoo Ticker</label>
                          <input
                            value={editForm.yahooTicker ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, yahooTicker: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                            placeholder="026960.KS"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">DART Corp Code</label>
                          <input
                            value={editForm.dartCorpCode ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, dartCorpCode: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                            placeholder="00296060 (8자리)"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 block mb-1">SEC CIK</label>
                          <input
                            value={editForm.secCik ?? ""}
                            onChange={(e) => setEditForm({ ...editForm, secCik: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                            placeholder="0001103982"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 카테고리 + 브로커 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">카테고리</label>
                        <select
                          value={editForm.category ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          {categoryOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">브로커</label>
                        <input
                          value={editForm.broker ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, broker: e.target.value })}
                          className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                          placeholder="대신증권"
                        />
                      </div>
                    </div>

                    {/* 투자 테제 */}
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">투자 테제</label>
                      <textarea
                        value={editForm.thesis ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, thesis: e.target.value })}
                        rows={3}
                        className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                        placeholder="왜 이 종목을 보유하고 있는가?"
                      />
                    </div>

                    {/* 메타 정보 및 액션 버튼 */}
                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-800/50">
                      <p className="text-xs text-zinc-700">
                        추가일: {new Date(stock.addedAt).toLocaleDateString("ko-KR")} · ID: {stock.id}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExpand(stock)}
                          className="px-4 py-2 text-xs font-medium text-zinc-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveForm}
                          disabled={saving}
                          className="px-6 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── 대출 관리 ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">💳 주식담보대출 관리</h2>
            <p className="text-xs text-zinc-500 mt-0.5">대출금액 · 이자율 입력 시 연간/월평균 이자 자동 계산</p>
          </div>
          <button
            onClick={() => { setShowLoanForm((v) => !v); setLoanError(null); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              showLoanForm
                ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                : "bg-orange-600/10 border-orange-500/30 text-orange-400 hover:bg-orange-600/20"
            }`}
          >
            {showLoanForm ? "✕ 닫기" : "+ 대출 추가"}
          </button>
        </div>

        {/* 대출 추가 폼 */}
        {showLoanForm && (
          <div className="px-6 py-5 bg-zinc-950/60 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">신규 대출 등록</h3>
            {loanError && (
              <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                ⚠️ {loanError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">대출명</label>
                <input
                  value={loanForm.label}
                  onChange={(e) => setLoanForm({ ...loanForm, label: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="주식담보대출"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">대출 시작일</label>
                <input
                  type="date"
                  value={loanForm.startedAt}
                  onChange={(e) => setLoanForm({ ...loanForm, startedAt: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">대출금액 (KRW) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  value={loanForm.loanAmount}
                  onChange={(e) => setLoanForm({ ...loanForm, loanAmount: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="50000000"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">연이자율 (%) <span className="text-red-400">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  value={loanForm.interestRate}
                  onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="4.5"
                />
              </div>
            </div>

            {/* 실시간 이자 계산 미리보기 */}
            {loanForm.loanAmount && loanForm.interestRate && (
              <div className="mb-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                <p className="text-xs text-zinc-400 mb-1.5">📊 이자 계산 미리보기</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-zinc-600">대출원금</p>
                    <p className="text-sm font-semibold text-orange-400 tabular-nums">
                      {Number(loanForm.loanAmount).toLocaleString("ko-KR")}원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">연간 이자</p>
                    <p className="text-sm font-semibold text-red-400 tabular-nums">
                      {Math.round(Number(loanForm.loanAmount) * Number(loanForm.interestRate) / 100).toLocaleString("ko-KR")}원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">월평균 이자</p>
                    <p className="text-sm font-semibold text-amber-400 tabular-nums">
                      {Math.round(Number(loanForm.loanAmount) * Number(loanForm.interestRate) / 100 / 12).toLocaleString("ko-KR")}원
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-zinc-500 block mb-1">메모</label>
              <input
                value={loanForm.note}
                onChange={(e) => setLoanForm({ ...loanForm, note: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                placeholder="대신증권 동서 담보 (동서 2600주)"
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => setShowLoanForm(false)}
                className="px-4 py-2 text-xs text-zinc-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddLoan}
                disabled={loanSaving}
                className="px-6 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {loanSaving ? "저장 중..." : "대출 등록"}
              </button>
            </div>
          </div>
        )}

        {/* 대출 목록 */}
        {loans.length === 0 && !showLoanForm ? (
          <div className="px-6 py-10 text-center">
            <p className="text-zinc-600 text-sm">등록된 대출이 없습니다</p>
            <p className="text-zinc-700 text-xs mt-1">주식담보대출이 있다면 위 버튼으로 추가하세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {loans.map((loan) => {
              const annual = loan.loanAmount * loan.interestRate / 100;
              const monthly = annual / 12;
              const inactive = loan.isActive === 0;
              return (
                <li key={loan.id} className={`px-6 py-4 ${inactive ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-4">
                    {/* 대출 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{loan.label}</span>
                        {inactive && <span className="text-xs bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">비활성</span>}
                        {loan.startedAt && <span className="text-xs text-zinc-600">시작: {loan.startedAt}</span>}
                      </div>
                      {loan.note && <p className="text-xs text-zinc-600 mb-1">{loan.note}</p>}
                      {/* 이자 계산 표시 */}
                      <div className="flex flex-wrap gap-3">
                        <span className="text-xs text-zinc-500">
                          원금 <span className="text-orange-400 font-medium tabular-nums">{loan.loanAmount.toLocaleString("ko-KR")}원</span>
                        </span>
                        <span className="text-xs text-zinc-500">
                          연{loan.interestRate}% → 연이자 <span className="text-red-400 font-medium tabular-nums">{Math.round(annual).toLocaleString("ko-KR")}원</span>
                        </span>
                        <span className="text-xs text-zinc-500">
                          월평균 <span className="text-amber-400 font-medium tabular-nums">{Math.round(monthly).toLocaleString("ko-KR")}원</span>
                        </span>
                      </div>
                    </div>
                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleLoan(loan)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          inactive
                            ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-zinc-800 hover:text-zinc-400"
                        }`}
                      >
                        {inactive ? "활성화" : "비활성화"}
                      </button>
                      <button
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── 안내 카드 ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">💡 사용 안내</h2>
        <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
          <p>• <span className="text-zinc-300 font-medium">식별자 (Yahoo/DART/SEC)</span>: 자동 데이터 수집에 사용됩니다. 정확히 입력해야 수집이 정상 동작합니다.</p>
          <p>• <span className="text-zinc-300 font-medium">카테고리 변경</span>: Core ↔ Satellite 전환은 즉시 대시보드 비중 차트에 반영됩니다.</p>
          <p>• <span className="text-zinc-300 font-medium">비활성화</span>: 종목 데이터는 보존하되 대시보드에서 제외됩니다. 완전 삭제가 아닙니다.</p>
          <p>• <span className="text-zinc-300 font-medium">신규 종목 추가</span>: 위 <span className="text-violet-400 font-medium">"+ 신규 종목 추가"</span> 버튼을 클릭하세요. Yahoo Ticker가 있어야 주가 자동 수집이 됩니다.</p>
          <p>• <span className="text-zinc-300 font-medium">대출 관리</span>: 대출금액 × 연이자율 ÷ 100 = 연간이자, ÷ 12 = 월평균이자로 자동 계산됩니다.</p>
        </div>
      </div>
    </div>
  );
}
