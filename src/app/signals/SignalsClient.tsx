"use client";

import { useState, useMemo, useTransition } from "react";
import type { SignalRow } from "./page";

interface Props {
  signals: SignalRow[];
}

const SEVERITY_CONFIG = {
  HIGH: {
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    label: "🔴 HIGH",
  },
  MEDIUM: {
    dot: "bg-amber-400",
    badge: "bg-amber-400/15 text-amber-400 border-amber-400/30",
    label: "🟡 MEDIUM",
  },
  LOW: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-[var(--color-brand-green)] border-emerald-500/30",
    label: "🟢 LOW",
  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  INSIDER_BUY: "내부자 매수",
  STAKE_CHANGE: "지분율 변동",
  SEC_MATERIAL: "10-Q 비경상",
  DIVIDEND_CHANGE: "배당 변동",
  FINANCIAL_DETERIORATION: "재무 악화",
  PRICE_SPIKE: "주가 급변",
};

export default function SignalsClient({ signals }: Props) {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterResolved, setFilterResolved] = useState<"ALL" | "UNRESOLVED" | "RESOLVED">("ALL");
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (filterSeverity !== "ALL" && s.severity !== filterSeverity) return false;
      if (filterResolved === "UNRESOLVED" && s.isResolved !== 0) return false;
      if (filterResolved === "RESOLVED" && s.isResolved === 0) return false;
      return true;
    });
  }, [signals, filterSeverity, filterResolved]);

  const unresolvedCount = signals.filter((s) => s.isResolved === 0 && s.severity === "HIGH").length;

  const handleResolve = async (id: number, note: string) => {
    setResolvingId(id);
    try {
      await fetch(`/api/signals/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      // 간단한 새로고침 트리거
      startTransition(() => {
        window.location.reload();
      });
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 통계 배지 */}
      <div className="flex gap-3 flex-wrap">
        <StatBadge
          label="미확인 HIGH"
          count={signals.filter((s) => s.isResolved === 0 && s.severity === "HIGH").length}
          color="red"
        />
        <StatBadge
          label="미확인 MEDIUM"
          count={signals.filter((s) => s.isResolved === 0 && s.severity === "MEDIUM").length}
          color="amber"
        />
        <StatBadge
          label="전체"
          count={signals.length}
          color="zinc"
        />
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterSeverity === sev
                  ? "bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)] font-bold border border-emerald-500/40"
                  : "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-strong)] hover:border-zinc-500"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(["ALL", "UNRESOLVED", "RESOLVED"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterResolved(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterResolved === r
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-strong)] hover:border-zinc-500"
              }`}
            >
              {r === "ALL" ? "전체" : r === "UNRESOLVED" ? "미확인" : "확인됨"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-[var(--color-text-disabled)]">{filtered.length}건</span>
      </div>

      {/* 시그널 리스트 */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              onResolve={handleResolve}
              isResolving={resolvingId === s.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({
  signal: s,
  onResolve,
  isResolving,
}: {
  signal: SignalRow;
  onResolve: (id: number, note: string) => void;
  isResolving: boolean;
}) {
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [note, setNote] = useState("");

  const sevConfig =
    SEVERITY_CONFIG[s.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.LOW;
  const typeLabel = TYPE_LABELS[s.type] ?? s.type;
  const detectedDate = s.detectedAt?.slice(0, 10) ?? "—";

  return (
    <div
      className={`bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm transition-colors ${
        s.isResolved === 0
          ? "border-[var(--color-border-strong)] hover:border-zinc-600"
          : "border-[var(--color-border-default)] opacity-60"
      }`}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* 심각도 도트 */}
          <div className="mt-1.5 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full ${sevConfig.dot} ${s.isResolved === 0 && s.severity === "HIGH" ? "animate-pulse" : ""}`} />
          </div>

          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${sevConfig.badge}`}
              >
                {sevConfig.label}
              </span>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{s.ticker}</span>
              <span className="text-xs text-[var(--color-text-disabled)]">·</span>
              <span className="text-xs text-[var(--color-text-muted)]">{typeLabel}</span>
              <span className="text-xs text-[var(--color-text-disabled)]">·</span>
              <span className="text-xs text-[var(--color-text-disabled)]">{detectedDate}</span>
            </div>

            <p className="text-sm text-[var(--color-text-primary)] leading-snug">{s.description}</p>

            {s.isResolved === 1 && s.resolvedNote && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2 bg-[var(--color-bg-elevated)]/50 px-3 py-1.5 rounded-lg">
                ✓ {s.resolvedNote}
              </p>
            )}

            {/* 확인 처리 폼 */}
            {s.isResolved === 0 && showResolveForm && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  placeholder="처리 메모 (선택)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onResolve(s.id, note);
                      setShowResolveForm(false);
                    }}
                    disabled={isResolving}
                    className="px-4 py-1.5 text-text-primary text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isResolving ? "처리 중..." : "확인 완료"}
                  </button>
                  <button
                    onClick={() => setShowResolveForm(false)}
                    className="px-4 py-1.5 bg-[var(--color-bg-elevated)] hover:bg-bg-elevated text-[var(--color-text-secondary)] text-xs font-medium rounded-lg transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          {s.isResolved === 0 && !showResolveForm && (
            <button
              onClick={() => setShowResolveForm(true)}
              className="shrink-0 mt-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-green)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--color-bg-elevated)]"
            >
              확인
            </button>
          )}
          {s.isResolved === 1 && (
            <span className="shrink-0 mt-0.5 text-xs text-[var(--color-text-disabled)]">✓ 완료</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "red" | "amber" | "zinc";
}) {
  const colorMap = {
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    amber: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    zinc: "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-strong)]",
  };
  return (
    <div className={`border rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 ${colorMap[color]}`}>
      <span className="font-bold text-base leading-none">{count}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[var(--color-bg-surface)] border-t-4 border-t-[var(--color-brand-green)] border-b border-x border-[var(--color-border-default)] rounded-sm shadow-sm px-8 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#71717a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <p className="text-[var(--color-text-secondary)] font-medium text-sm">감지된 시그널이 없습니다</p>
      <p className="text-[var(--color-text-disabled)] text-xs mt-1">
        daily_dart.py에서 HIGH 시그널 감지 시 여기에 표시됩니다
      </p>
    </div>
  );
}
