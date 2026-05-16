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

type EditingField = {
  id: number;
  field: string;
  value: string;
} | null;

export default function SettingsClient({ stocks: initialStocks }: Props) {
  const [stocks, setStocks] = useState(initialStocks);
  const [editing, setEditing] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEdit = (id: number, field: string, current: string) => {
    setEditing({ id, field, value: current });
    setSaveError(null);
  };

  const cancelEdit = () => setEditing(null);

  const commitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);

    // field name to DB column mapping
    const fieldMap: Record<string, string> = {
      broker: "broker",
      thesis: "thesis",
      category: "category",
      yahooTicker: "yahoo_ticker",
      dartCorpCode: "dart_corp_code",
      secCik: "sec_cik",
    };
    const dbField = fieldMap[editing.field];
    if (!dbField) { setEditing(null); setSaving(false); return; }

    try {
      const res = await fetch("/api/settings/stocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, field: dbField, value: editing.value }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "저장 실패");
        return;
      }
      // 로컬 상태 업데이트
      setStocks((prev) =>
        prev.map((s) =>
          s.id === editing.id ? { ...s, [editing.field]: editing.value } : s
        )
      );
      setEditing(null);
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">관심종목 관리</h2>
          <p className="text-xs text-zinc-500 mt-0.5">클릭하여 상세 정보 확인 및 편집</p>
        </div>

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
                  onClick={() => setExpandedId((prev) => (prev === stock.id ? null : stock.id))}
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
                {isExpanded && (
                  <div className="px-6 py-5 bg-zinc-950/50 border-t border-zinc-800/50 space-y-4">
                    {/* 식별자 그리드 */}
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                        데이터 소스 식별자
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: "Yahoo Ticker", field: "yahooTicker", value: stock.yahooTicker, placeholder: "026960.KS" },
                          { label: "DART Corp Code", field: "dartCorpCode", value: stock.dartCorpCode, placeholder: "00296060 (8자리)" },
                          { label: "SEC CIK", field: "secCik", value: stock.secCik, placeholder: "0001103982" },
                        ].map(({ label, field, value, placeholder }) => {
                          const isEditingThis = editing?.id === stock.id && editing?.field === field;
                          return (
                            <div key={field}>
                              <label className="text-xs text-zinc-500 block mb-1">{label}</label>
                              {isEditingThis ? (
                                <div className="flex gap-1.5">
                                  <input
                                    autoFocus
                                    value={editing.value}
                                    onChange={(e) => setEditing((prev) => prev ? { ...prev, value: e.target.value } : null)}
                                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                                    className="flex-1 bg-zinc-800 border border-violet-500/50 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    placeholder={placeholder}
                                  />
                                  <button onClick={commitEdit} disabled={saving} className="px-2 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg disabled:opacity-50">
                                    {saving ? "..." : "✓"}
                                  </button>
                                  <button onClick={cancelEdit} className="px-2 py-1.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg">✕</button>
                                </div>
                              ) : (
                                <button
                                  id={`btn-edit-${field}-${stock.id}`}
                                  onClick={() => startEdit(stock.id, field, value)}
                                  className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 transition-colors truncate"
                                >
                                  {value || <span className="text-zinc-600 italic">{placeholder}</span>}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 카테고리 + 브로커 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 카테고리 선택 */}
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">카테고리</label>
                        <select
                          id={`select-category-${stock.id}`}
                          value={editing?.id === stock.id && editing?.field === "category" ? editing.value : stock.category}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            setEditing({ id: stock.id, field: "category", value: newVal });
                            setSaving(true);
                            try {
                              const res = await fetch("/api/settings/stocks", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: stock.id, field: "category", value: newVal }),
                              });
                              if (res.ok) {
                                setStocks((prev) =>
                                  prev.map((s) => s.id === stock.id ? { ...s, category: newVal } : s)
                                );
                              }
                            } finally {
                              setSaving(false);
                              setEditing(null);
                            }
                          }}
                          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          {categoryOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* 브로커 */}
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">브로커</label>
                        {editing?.id === stock.id && editing?.field === "broker" ? (
                          <div className="flex gap-1.5">
                            <input
                              autoFocus
                              value={editing.value}
                              onChange={(e) => setEditing((prev) => prev ? { ...prev, value: e.target.value } : null)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                              className="flex-1 bg-zinc-800 border border-violet-500/50 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                              placeholder="대신증권"
                            />
                            <button onClick={commitEdit} disabled={saving} className="px-2 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg disabled:opacity-50">
                              {saving ? "..." : "✓"}
                            </button>
                            <button onClick={cancelEdit} className="px-2 py-1.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg">✕</button>
                          </div>
                        ) : (
                          <button
                            id={`btn-edit-broker-${stock.id}`}
                            onClick={() => startEdit(stock.id, "broker", stock.broker)}
                            className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            {stock.broker || <span className="text-zinc-600 italic">대신증권</span>}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 투자 테제 */}
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">투자 테제</label>
                      {editing?.id === stock.id && editing?.field === "thesis" ? (
                        <div className="space-y-2">
                          <textarea
                            autoFocus
                            value={editing.value}
                            onChange={(e) => setEditing((prev) => prev ? { ...prev, value: e.target.value } : null)}
                            rows={3}
                            className="w-full bg-zinc-800 border border-violet-500/50 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                            placeholder="왜 이 종목을 보유하고 있는가?"
                          />
                          <div className="flex gap-2">
                            <button onClick={commitEdit} disabled={saving} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg disabled:opacity-50">
                              {saving ? "저장 중..." : "저장"}
                            </button>
                            <button onClick={cancelEdit} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          id={`btn-edit-thesis-${stock.id}`}
                          onClick={() => startEdit(stock.id, "thesis", stock.thesis)}
                          className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 text-xs text-zinc-300 rounded-xl px-3 py-2.5 transition-colors leading-relaxed min-h-[3rem]"
                        >
                          {stock.thesis || <span className="text-zinc-600 italic">클릭하여 투자 테제 입력...</span>}
                        </button>
                      )}
                    </div>

                    {/* 메타 정보 */}
                    <p className="text-xs text-zinc-700">
                      추가일: {new Date(stock.addedAt).toLocaleDateString("ko-KR")} · ID: {stock.id}
                    </p>
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
          <p>• <span className="text-zinc-300 font-medium">신규 종목 추가</span>: 발굴 페이지 <a href="/discover" className="text-violet-400 hover:text-violet-300">(/discover)</a>에서 추가하세요.</p>
        </div>
      </div>
    </div>
  );
}
