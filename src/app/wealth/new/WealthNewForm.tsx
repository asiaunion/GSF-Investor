"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnNeutral, btnPrimary, inputClass } from "@/lib/economist-ui";
import { WEALTH_CATEGORY_OPTIONS } from "@/lib/wealth-categories";

export default function WealthNewForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    category: "예수금",
    broker: "",
    name: "예수금(현금)",
    valueKrw: "",
    quantity: "1",
    bookValue: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wealth/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          broker: form.broker,
          name: form.name,
          valueKrw: Number(form.valueKrw),
          quantity: Number(form.quantity) || 1,
          bookValue: form.bookValue ? Number(form.bookValue) : null,
          note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      router.push("/wealth");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-xs text-text-muted mb-1">분류</label>
        <select
          className={inputClass}
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          {WEALTH_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">
          증권사/은행 {form.category === "예수금" && "(필수)"}
        </label>
        <input
          className={inputClass}
          value={form.broker}
          onChange={(e) => setForm((f) => ({ ...f, broker: e.target.value }))}
          placeholder="키움증권, 신한은행 등"
          required={form.category === "예수금"}
        />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">이름</label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">금액 (KRW)</label>
        <input
          className={inputClass}
          type="number"
          value={form.valueKrw}
          onChange={(e) => setForm((f) => ({ ...f, valueKrw: e.target.value }))}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">수량 (선택)</label>
          <input
            className={inputClass}
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">장부단가 (선택)</label>
          <input
            className={inputClass}
            type="number"
            value={form.bookValue}
            onChange={(e) => setForm((f) => ({ ...f, bookValue: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">메모</label>
        <input
          className={inputClass}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </div>
      {error && <p className="text-sm text-loss-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className={`${btnPrimary} px-4 py-2 text-sm rounded-sm`}
          disabled={saving}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          className={`${btnNeutral} px-4 py-2 text-sm rounded-sm`}
          onClick={() => router.back()}
        >
          취소
        </button>
      </div>
    </form>
  );
}
