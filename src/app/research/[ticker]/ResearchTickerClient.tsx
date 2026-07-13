"use client";

import { useState } from "react";

interface ThesisData {
  action: string;
  conviction: string | null;
  fairValueLocal: number | null;
  expectedReturnPct: number | null;
  nextCatalyst: string | null;
  thesisSummary: string | null;
}

interface ThesisForm {
  action: string;
  conviction: string;
  fairValueLocal: string;
  expectedReturnPct: string;
  nextCatalyst: string;
  thesisSummary: string;
}

const inputClass =
  "w-full bg-bg-surface border border-border-default rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-green/50 placeholder:text-text-muted/50 transition-colors";

const btnPrimarySm =
  "bg-brand-green hover:bg-brand-green/90 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function ResearchTickerClient({
  stockId,
  initialThesis,
}: {
  stockId: number;
  initialThesis: ThesisData | null;
}) {
  const [form, setForm] = useState<ThesisForm>({
    action: initialThesis?.action ?? "관찰",
    conviction: initialThesis?.conviction ?? "",
    fairValueLocal: initialThesis?.fairValueLocal?.toString() ?? "",
    expectedReturnPct: initialThesis?.expectedReturnPct?.toString() ?? "",
    nextCatalyst: initialThesis?.nextCatalyst ?? "",
    thesisSummary: initialThesis?.thesisSummary ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/research/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId,
          action: form.action,
          conviction: form.conviction || null,
          fairValueLocal: form.fairValueLocal ? parseFloat(form.fairValueLocal) : null,
          expectedReturnPct: form.expectedReturnPct ? parseFloat(form.expectedReturnPct) : null,
          nextCatalyst: form.nextCatalyst || null,
          thesisSummary: form.thesisSummary || null,
        }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, type = "text", placeholder = "" }: {
    label: string; name: keyof ThesisForm; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-bg-surface border border-border-default rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-text-primary">투자 판단</h2>

        {/* Action */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Action</label>
          <div className="flex gap-2">
            {["보유", "매수", "매도", "관찰"].map((a) => (
              <button
                key={a}
                onClick={() => setForm((f) => ({ ...f, action: a }))}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  form.action === a
                    ? "bg-brand-green border-brand-green text-white font-semibold"
                    : "border-border-strong text-text-secondary hover:border-brand-green/40"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Conviction */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Conviction</label>
          <div className="flex gap-2">
            {["High", "Mid", "Low"].map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, conviction: c }))}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  form.conviction === c
                    ? "bg-brand-green/15 border-brand-green text-brand-green font-semibold"
                    : "border-border-strong text-text-secondary hover:border-brand-green/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="목표 주가 (현지 통화)" name="fairValueLocal" type="number" placeholder="35000" />
          <Field label="기대 수익률 (%)" name="expectedReturnPct" type="number" placeholder="29.7" />
        </div>

        <Field label="Next Catalyst" name="nextCatalyst" placeholder="8월 반기보고서 · 배당락일 등" />

        <div>
          <label className="block text-xs text-text-muted mb-1">투자 논거 요약</label>
          <textarea
            value={form.thesisSummary}
            onChange={(e) => setForm((f) => ({ ...f, thesisSummary: e.target.value }))}
            rows={3}
            placeholder="저평가 가치주 + 지분 이벤트 드리븐..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`${btnPrimarySm} w-full`}
        >
          {saving ? "저장 중..." : saved ? "저장됨 ✓" : "저장"}
        </button>
      </div>
    </div>
  );
}
