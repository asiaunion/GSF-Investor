"use client";

import { useCallback, useEffect, useState } from "react";
import { btnPrimary, swsCard } from "@/lib/economist-ui";

const CURRENCIES = ["KRW", "USD", "JPY"] as const;

export default function CurrencyPreferenceSection() {
  const [currency, setCurrency] = useState<string>("KRW");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/preferences");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setCurrency(data.baseCurrency ?? "KRW");
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정 불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = async (next: string) => {
    if (next === currency) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setCurrency(data.baseCurrency ?? next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${swsCard} p-6`}>
      <h2 className="text-base font-semibold text-text-primary mb-1">기준 통화</h2>
      <p className="text-xs text-text-muted mb-4">
        히어로·P&L·전체 자산 표시에 사용합니다. (차트 축은 추후 확장)
      </p>
      {error && (
        <p className="text-xs text-loss-400 mb-3">⚠️ {error}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={loading || saving}
            onClick={() => handleChange(c)}
            className={`px-4 py-2 text-xs font-semibold rounded-sm border transition-colors disabled:opacity-50 ${
              currency === c
                ? btnPrimary
                : "border-border-strong text-text-secondary hover:bg-bg-elevated"
            }`}
          >
            {c}
          </button>
        ))}
        {loading && <span className="text-xs text-text-muted">불러오는 중…</span>}
        {saving && <span className="text-xs text-text-muted">저장 중…</span>}
        {saved && <span className="text-xs text-brand-green">저장됨</span>}
      </div>
    </div>
  );
}
