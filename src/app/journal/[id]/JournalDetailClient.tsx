"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type JournalRow = {
  id: number;
  stockId: number | null;
  ticker: string | null;
  name: string | null;
  tradedAt: string;
  action: string;
  quantity: number;
  price: number;
  currency: string | null;
  thesis: string;
  category: string | null;
  emotionTag: string | null;
  retrospective: string | null;
};

const EMOTIONS = ["확신", "계획적", "불안", "충동"];

const emotionColors: Record<string, string> = {
  확신: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
  계획적: "border-blue-500/60 bg-blue-500/10 text-blue-300",
  불안: "border-amber-500/60 bg-amber-500/10 text-amber-300",
  충동: "border-red-500/60 bg-red-500/10 text-red-300",
};

export default function JournalDetailClient({ initial }: { initial: JournalRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tradedAt: initial.tradedAt,
    action: initial.action,
    quantity: String(initial.quantity),
    price: String(initial.price),
    thesis: initial.thesis,
    emotionTag: initial.emotionTag ?? "",
    retrospective: initial.retrospective ?? "",
  });

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/journal/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          price: Number(form.price),
          emotionTag: form.emotionTag || null,
          retrospective: form.retrospective || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "저장 실패");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    await fetch(`/api/journal/${initial.id}`, { method: "DELETE" });
    router.push("/journal");
  }

  const totalAmount = (Number(form.quantity) * Number(form.price)).toLocaleString("ko-KR");

  const actionColor =
    initial.action === "BUY"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : initial.action === "SELL"
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : "text-text-secondary bg-bg-elevated/30 border-zinc-600/30";

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 헤더 카드 */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl font-bold font-mono text-text-primary">{initial.ticker}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${actionColor}`}>
                {initial.action}
              </span>
              {initial.emotionTag && !editing && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${emotionColors[initial.emotionTag] ?? "text-text-secondary bg-bg-elevated/30 border-zinc-600/30"}`}>
                  {initial.emotionTag}
                </span>
              )}
            </div>
            <p className="text-text-muted text-sm">{initial.name}</p>
          </div>
          <div className="flex gap-2 items-center">
            {!editing ? (
              <>
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-red-400 mr-1">정말 삭제할까요?</span>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 bg-bg-elevated hover:bg-bg-elevated border border-border-default text-text-secondary text-sm rounded-xl transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleDeleteConfirmed}
                      disabled={deleting}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 text-text-primary text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {deleting ? "삭제 중..." : "확인"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditing(true)}
                      className="px-3 py-2 bg-bg-elevated hover:bg-bg-elevated border border-border-default text-text-secondary text-sm rounded-xl transition-colors"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-xl transition-colors"
                    >
                      삭제
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 bg-bg-elevated hover:bg-bg-elevated border border-border-default text-text-secondary text-sm rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-text-primary text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 거래 정보 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "거래일",
              value: editing ? (
                <input
                  type="date"
                  value={form.tradedAt}
                  onChange={set("tradedAt")}
                  className="bg-bg-elevated border border-border-default rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-emerald-500/60 w-full"
                />
              ) : (
                <span className="text-text-primary text-sm">{initial.tradedAt}</span>
              ),
            },
            {
              label: "수량",
              value: editing ? (
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={set("quantity")}
                  className="bg-bg-elevated border border-border-default rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-emerald-500/60 w-full"
                />
              ) : (
                <span className="text-text-primary text-sm">{initial.quantity.toLocaleString()}주</span>
              ),
            },
            {
              label: "단가",
              value: editing ? (
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.price}
                  onChange={set("price")}
                  className="bg-bg-elevated border border-border-default rounded-lg px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-emerald-500/60 w-full"
                />
              ) : (
                <span className="text-text-primary text-sm">₩{initial.price.toLocaleString()}</span>
              ),
            },
            {
              label: "거래 총액",
              value: (
                <span className="text-emerald-400 text-sm font-bold">
                  ₩{totalAmount}
                </span>
              ),
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-bg-elevated/40 rounded-xl p-3">
              <p className="text-xs text-text-muted mb-1.5">{label}</p>
              {value}
            </div>
          ))}
        </div>
      </div>

      {/* 테제 */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">투자 테제</h2>
        {editing ? (
          <textarea
            rows={4}
            value={form.thesis}
            onChange={set("thesis")}
            required
            className="w-full bg-bg-elevated border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
          />
        ) : (
          <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{initial.thesis}</p>
        )}
      </div>

      {/* 감정 태그 (편집 시) */}
      {editing && (
        <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">감정 태그</h2>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    emotionTag: prev.emotionTag === e ? "" : e,
                  }))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  form.emotionTag === e
                    ? emotionColors[e]
                    : "bg-bg-elevated border-border-default text-text-muted hover:border-zinc-600"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 회고 */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">회고</h2>
        {editing ? (
          <textarea
            rows={4}
            value={form.retrospective}
            onChange={set("retrospective")}
            placeholder="이 거래에 대한 회고를 기록하세요..."
            className="w-full bg-bg-elevated border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
          />
        ) : initial.retrospective ? (
          <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{initial.retrospective}</p>
        ) : (
          <p className="text-text-muted text-sm italic">아직 회고가 없습니다. 편집 버튼을 눌러 추가하세요.</p>
        )}
      </div>
    </div>
  );
}
