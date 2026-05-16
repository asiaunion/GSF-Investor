"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Stock = {
  id: number;
  ticker: string;
  name: string;
  market: string;
  category: string | null;
};

type Props = {
  onSuccess: () => void;
};

const EMOTIONS = [
  { value: "확신", label: "확신 💪", color: "emerald" },
  { value: "계획적", label: "계획적 🎯", color: "blue" },
  { value: "불안", label: "불안 😰", color: "amber" },
  { value: "충동", label: "충동 ⚡", color: "red" },
];

const emotionColors: Record<string, string> = {
  확신: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
  계획적: "border-blue-500/60 bg-blue-500/10 text-blue-300",
  불안: "border-amber-500/60 bg-amber-500/10 text-amber-300",
  충동: "border-red-500/60 bg-red-500/10 text-red-300",
};

export default function JournalForm({ onSuccess }: Props) {
  const router = useRouter();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    stockId: "",
    tradedAt: new Date().toISOString().slice(0, 10),
    action: "BUY" as "BUY" | "SELL" | "INIT",
    quantity: "",
    price: "",
    currency: "KRW",
    thesis: "",
    category: "Core",
    emotionTag: "",
    confidenceScore: 0,
    retrospective: "",
  });

  useEffect(() => {
    fetch("/api/stocks")
      .then((r) => r.json())
      .then((data) => setStocks(Array.isArray(data) ? data : (data.stocks ?? [])))
      .catch(() => setError("종목 로딩 실패"));
  }, []);

  const totalAmount =
    form.quantity && form.price
      ? (Number(form.quantity) * Number(form.price)).toLocaleString("ko-KR")
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          stockId: Number(form.stockId),
          quantity: Number(form.quantity),
          price: Number(form.price),
          emotionTag: form.emotionTag || null,
          confidenceScore: form.confidenceScore || null,
          retrospective: form.retrospective || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장 실패");
      }

      // 폼 초기화
      setForm((prev) => ({
        ...prev,
        quantity: "",
        price: "",
        thesis: "",
        emotionTag: "",
        confidenceScore: 0,
        retrospective: "",
      }));

      onSuccess();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 종목 + 날짜 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">종목 *</label>
          <select
            required
            value={form.stockId}
            onChange={set("stockId")}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition-colors"
          >
            <option value="">종목 선택...</option>
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ticker} — {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">거래일 *</label>
          <input
            type="date"
            required
            value={form.tradedAt}
            onChange={set("tradedAt")}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
        </div>
      </div>

      {/* 액션 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">거래 유형 *</label>
        <div className="flex gap-2">
          {(["BUY", "SELL"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, action: a }))}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                form.action === a
                  ? a === "BUY"
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                    : "bg-red-500/20 border-red-500/60 text-red-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {a === "BUY" ? "📈 매수" : "📉 매도"}
            </button>
          ))}
        </div>
      </div>

      {/* 수량 + 가격 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">수량 (주) *</label>
          <input
            type="number"
            required
            min="1"
            placeholder="0"
            value={form.quantity}
            onChange={set("quantity")}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">단가 (원) *</label>
          <input
            type="number"
            required
            min="0"
            step="any"
            placeholder="0"
            value={form.price}
            onChange={set("price")}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
        </div>
      </div>

      {/* 거래 총액 미리보기 */}
      {totalAmount && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500">거래 총액</span>
          <span className="text-sm font-bold text-white">₩{totalAmount}</span>
        </div>
      )}

      {/* 테제 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          투자 테제 * <span className="text-zinc-600 normal-case">(왜 이 거래를 했는가?)</span>
        </label>
        <textarea
          required
          rows={3}
          placeholder="예: 몬델리즈 지분 매각 시그널 포착. 내재가치 대비 40% 할인 구간 진입. 배당 수익률 3.2% 안전마진 확보..."
          value={form.thesis}
          onChange={set("thesis")}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
        />
      </div>

      {/* 감정 태그 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">감정 태그</label>
        <div className="flex flex-wrap gap-2">
          {EMOTIONS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  emotionTag: prev.emotionTag === e.value ? "" : e.value,
                }))
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                form.emotionTag === e.value
                  ? emotionColors[e.value]
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* 확신도 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          확신도{" "}
          <span className="text-zinc-600 normal-case">(이 거래에 대한 확신 1~5점)</span>
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((score) => {
            const isActive = form.confidenceScore >= score;
            const color =
              score <= 1 ? "text-red-400 border-red-500/50 bg-red-500/10"
              : score <= 2 ? "text-amber-400 border-amber-500/50 bg-amber-500/10"
              : score <= 3 ? "text-yellow-400 border-yellow-500/50 bg-yellow-500/10"
              : score <= 4 ? "text-blue-400 border-blue-500/50 bg-blue-500/10"
              : "text-emerald-400 border-emerald-500/50 bg-emerald-500/10";
            return (
              <button
                key={score}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    confidenceScore: prev.confidenceScore === score ? 0 : score,
                  }))
                }
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                  isActive
                    ? color
                    : "bg-zinc-800 border-zinc-700 text-zinc-600 hover:border-zinc-600"
                }`}
              >
                {score === 1 ? "😰" : score === 2 ? "😕" : score === 3 ? "😐" : score === 4 ? "😊" : "💪"}
                <span className="block text-[10px] mt-0.5">{score}점</span>
              </button>
            );
          })}
        </div>
        {form.confidenceScore > 0 && (
          <p className="text-[11px] text-zinc-600">
            {form.confidenceScore === 1 && "매우 불확실 — 정말 이 거래를 해야 할까요?"}
            {form.confidenceScore === 2 && "불확실 — 리스크 관리에 주의하세요."}
            {form.confidenceScore === 3 && "보통 — 평균적인 확신도입니다."}
            {form.confidenceScore === 4 && "높음 — 충분한 근거가 있는 거래입니다."}
            {form.confidenceScore === 5 && "매우 높음 — 강력한 확신의 거래입니다."}
          </p>
        )}
      </div>

      {/* 회고 */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          회고 <span className="text-zinc-600 normal-case">(선택)</span>
        </label>
        <textarea
          rows={2}
          placeholder="나중에 추가할 수 있습니다..."
          value={form.retrospective}
          onChange={set("retrospective")}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
      >
        {loading ? "저장 중..." : "매매 일지 저장"}
      </button>
    </form>
  );
}
