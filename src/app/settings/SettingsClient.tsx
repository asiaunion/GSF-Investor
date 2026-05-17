"use client";

import { useState } from "react";
import type { StockSetting } from "./page";

type Props = {
  stocks: StockSetting[];
};

const categoryOptions = ["Core", "Satellite"];
const marketBadge: Record<string, string> = {
  KR: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  US: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

export default function SettingsClient({ stocks: initialStocks }: Props) {
  const [stocks, setStocks] = useState(initialStocks);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockSetting> | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 신규 종목 추가 ──────────────────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    ticker: "",
    name: "",
    market: "KR",
    category: "Core",
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
      setAddForm({ ticker: "", name: "", market: "KR", category: "Core", yahooTicker: "", dartCorpCode: "", secCik: "", broker: "", thesis: "" });
      setShowAddForm(false);
      // 목록에 즉시 반영
      window.location.reload();
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAddSaving(false);
    }
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

            {/* 선택 필드 */}
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
                <label className="text-xs text-zinc-500 block mb-1">DART Corp Code</label>
                <input
                  value={addForm.dartCorpCode}
                  onChange={(e) => setAddForm({ ...addForm, dartCorpCode: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  placeholder="00296060"
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

      {/* ── 안내 카드 ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-3">💡 사용 안내</h2>
        <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
          <p>• <span className="text-zinc-300 font-medium">식별자 (Yahoo/DART/SEC)</span>: 자동 데이터 수집에 사용됩니다. 정확히 입력해야 수집이 정상 동작합니다.</p>
          <p>• <span className="text-zinc-300 font-medium">카테고리 변경</span>: Core ↔ Satellite 전환은 즉시 대시보드 비중 차트에 반영됩니다.</p>
          <p>• <span className="text-zinc-300 font-medium">비활성화</span>: 종목 데이터는 보존하되 대시보드에서 제외됩니다. 완전 삭제가 아닙니다.</p>
          <p>• <span className="text-zinc-300 font-medium">신규 종목 추가</span>: 위 <span className="text-violet-400 font-medium">"+ 신규 종목 추가"</span> 버튼을 클릭하세요. Yahoo Ticker가 있어야 주가 자동 수집이 됩니다.</p>
        </div>
      </div>
    </div>
  );
}
