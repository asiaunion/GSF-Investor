"use client";

import { useState } from "react";
import Link from "next/link";
import type { NetWorthSummary, WealthPositionRow } from "@/lib/net-worth";
import {
  btnNeutral,
  btnPrimary,
  economistCard,
  economistStatCard,
  inputClass,
} from "@/lib/economist-ui";
import { WEALTH_CATEGORY_OPTIONS } from "@/lib/wealth-categories";

type Props = {
  initial: NetWorthSummary;
};

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
}

export default function WealthClient({ initial }: Props) {
  const [summary, setSummary] = useState(initial);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "유가증권 및 현금": true,
    부동산: false,
    "대출 및 부채": false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<WealthPositionRow>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/wealth/summary");
    if (res.ok) setSummary(await res.json());
  };

  const chartAssets = summary.positions.filter((p) => !p.isLiability);
  let chartTotal = summary.securitiesKrw;
  const chartDist: Record<string, number> = { "유가증권(매매일지)": summary.securitiesKrw };
  chartAssets.forEach((p) => {
    chartTotal += p.valueKrw;
    const key = p.bigCategory;
    chartDist[key] = (chartDist[key] ?? 0) + p.valueKrw;
  });

  const chartData = Object.entries(chartDist)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: chartTotal > 0 ? (value / chartTotal) * 100 : 0,
    }));

  const byBig: Record<string, WealthPositionRow[]> = {
    "유가증권 및 현금": [],
    부동산: [],
    "대출 및 부채": [],
  };
  summary.positions.forEach((p) => {
    if (byBig[p.bigCategory]) byBig[p.bigCategory].push(p);
  });

  const startEdit = (p: WealthPositionRow) => {
    setEditingId(p.id);
    setEditForm(p);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wealth/positions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: editForm.category,
          broker: editForm.broker,
          name: editForm.name,
          valueKrw: editForm.valueKrw,
          quantity: editForm.quantity,
          bookValue: editForm.bookValue,
          note: editForm.note,
          isLiability: editForm.isLiability,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "저장 실패");
      }
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const deletePosition = async (id: number) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    await fetch(`/api/wealth/positions/${id}`, { method: "DELETE" });
    await refresh();
  };

  return (
    <div className="space-y-6">
      <section className={`${economistStatCard} grid grid-cols-1 sm:grid-cols-3 gap-4`}>
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide">순자산</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {formatKrw(summary.netWorthKrw)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">총자산</p>
          <p className="text-lg font-semibold text-gain-400 mt-1">
            {formatKrw(summary.totalAssetsKrw)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            주식 {formatKrw(summary.securitiesKrw)} · 비주식 {formatKrw(summary.wealthAssetsKrw)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">총부채</p>
          <p className="text-lg font-semibold text-loss-400 mt-1">
            {formatKrw(summary.totalDebtKrw)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            담보대출 {formatKrw(summary.stockLoansKrw)} 포함
          </p>
        </div>
      </section>

      {chartData.length > 0 && (
        <section className={`${economistCard} p-4`}>
          <h2 className="text-sm font-bold text-text-primary mb-3">자산 구성</h2>
          <div className="space-y-2">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-text-secondary">{d.name}</span>
                <div className="flex-1 h-2 bg-bg-elevated rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-brand-green"
                    style={{ width: `${Math.min(d.pct, 100)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-text-muted">{d.pct.toFixed(1)}%</span>
                <span className="w-28 text-right font-medium">{formatKrw(d.value)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <Link href="/wealth/new" className={`${btnPrimary} px-4 py-2 text-sm rounded-sm`}>
          항목 추가
        </Link>
      </div>

      {(["유가증권 및 현금", "부동산", "대출 및 부채"] as const).map((big) => {
        const items = byBig[big];
        const subtotal = items.reduce(
          (s, i) => s + (i.isLiability ? i.valueKrw : i.valueKrw),
          0
        );
        return (
          <section key={big} className={economistCard}>
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setExpanded((e) => ({ ...e, [big]: !e[big] }))}
            >
              <span className="font-bold text-text-primary">{big}</span>
              <span className="text-sm text-text-muted">
                {items.length}건 · {formatKrw(subtotal)}
              </span>
            </button>
            {expanded[big] && (
              <div className="border-t border-border-default divide-y divide-border-default">
                {big === "유가증권 및 현금" && summary.securitiesKrw > 0 && (
                  <div className="px-4 py-3 flex justify-between text-sm">
                    <span className="text-text-secondary">주식 (매매 일지)</span>
                    <span className="font-medium">{formatKrw(summary.securitiesKrw)}</span>
                  </div>
                )}
                {items.length === 0 && big !== "유가증권 및 현금" && (
                  <p className="px-4 py-6 text-sm text-text-muted">항목 없음</p>
                )}
                {items.map((p) => (
                  <div key={p.id} className="px-4 py-3">
                    {editingId === p.id ? (
                      <div className="space-y-2">
                        <select
                          className={inputClass}
                          value={editForm.category ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, category: e.target.value }))
                          }
                        >
                          {WEALTH_CATEGORY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input
                          className={inputClass}
                          placeholder="증권사/은행"
                          value={editForm.broker ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, broker: e.target.value }))
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder="이름"
                          value={editForm.name ?? ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <input
                          className={inputClass}
                          type="number"
                          placeholder="금액(KRW)"
                          value={editForm.valueKrw ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              valueKrw: Number(e.target.value),
                            }))
                          }
                        />
                        {error && <p className="text-xs text-loss-400">{error}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`${btnPrimary} px-3 py-1.5 text-sm rounded-sm`}
                            disabled={saving}
                            onClick={saveEdit}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            className={`${btnNeutral} px-3 py-1.5 text-sm rounded-sm`}
                            onClick={() => setEditingId(null)}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-text-primary">{p.name}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {p.category}
                            {p.broker ? ` · ${p.broker}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={
                              p.isLiability ? "text-loss-400 font-semibold" : "font-semibold"
                            }
                          >
                            {formatKrw(p.valueKrw)}
                          </p>
                          <div className="flex gap-2 mt-2 justify-end">
                            <button
                              type="button"
                              className="text-xs text-brand-green hover:underline"
                              onClick={() => startEdit(p)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="text-xs text-loss-400 hover:underline"
                              onClick={() => deletePosition(p.id)}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {summary.securitiesKrw === 0 && (
        <p className="text-sm text-text-muted text-center py-4">
          주식 평가는{" "}
          <Link href="/journal" className="text-brand-green hover:underline">
            매매 일지
          </Link>
          에서 포지션을 입력하면 반영됩니다.
        </p>
      )}
    </div>
  );
}
