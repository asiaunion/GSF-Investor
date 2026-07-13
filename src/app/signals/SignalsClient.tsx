"use client";

import { useState, useMemo, useTransition } from "react";
import {
  btnNeutral,
  btnPrimary,
  swsCard,
  inputClass,
  severityConfig,
  tabActive,
  tabInactive,
} from "@/lib/economist-ui";
import {
  EconomistEmptyState,
  EconomistFilterRow,
  EconomistPanel,
  EconomistPanelBody,
  EconomistPanelHeader,
  EconomistStatGrid,
} from "@/components/EconomistPage";
import StockIdentity from "@/components/StockIdentity";
export type SignalRow = {
  id: number;
  stockId: number;
  ticker: string;
  stockName: string;
  detectedAt: string;
  type: string;
  severity: string;
  description: string;
  isResolved: number;
  resolvedNote: string | null;
};

interface Props {
  signals: SignalRow[];
}

const SEVERITY_CONFIG = {
  HIGH: { ...severityConfig.HIGH, label: "HIGH" },
  MEDIUM: { ...severityConfig.MEDIUM, label: "MEDIUM" },
  LOW: { ...severityConfig.LOW, label: "LOW" },
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
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (filterSeverity !== "ALL" && s.severity !== filterSeverity) return false;
      if (filterResolved === "UNRESOLVED" && s.isResolved !== 0) return false;
      if (filterResolved === "RESOLVED" && s.isResolved === 0) return false;
      return true;
    });
  }, [signals, filterSeverity, filterResolved]);

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
    <div className="space-y-6">
      <EconomistStatGrid
        items={[
          {
            label: "미확인 HIGH",
            value: signals.filter((s) => s.isResolved === 0 && s.severity === "HIGH").length,
            valueClassName: "text-loss-400",
          },
          {
            label: "미확인 MEDIUM",
            value: signals.filter((s) => s.isResolved === 0 && s.severity === "MEDIUM").length,
            valueClassName: "text-warn-400",
          },
          { label: "전체 시그널", value: signals.length },
          { label: "표시 중", value: filtered.length, valueClassName: "text-brand-green" },
        ]}
      />

      <EconomistFilterRow countLabel={`${filtered.length}건`}>
        <div className="flex gap-1">
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-sm text-xs transition-all ${
                filterSeverity === sev ? tabActive : tabInactive
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
              className={`px-3 py-1.5 rounded-sm text-xs transition-all ${
                filterResolved === r ? tabActive : tabInactive
              }`}
            >
              {r === "ALL" ? "전체" : r === "UNRESOLVED" ? "미확인" : "확인됨"}
            </button>
          ))}
        </div>
      </EconomistFilterRow>

      {filtered.length === 0 ? (
        <EconomistEmptyState
          title="감지된 시그널이 없습니다"
          description="daily_dart.py에서 HIGH 시그널 감지 시 여기에 표시됩니다"
        />
      ) : (
        <EconomistPanel>
          <EconomistPanelHeader title="시그널 목록" subtitle="미확인 항목 우선 · 확인 처리 가능" />
          <EconomistPanelBody className="space-y-2 py-4">
            {filtered.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                onResolve={handleResolve}
                isResolving={resolvingId === s.id}
              />
            ))}
          </EconomistPanelBody>
        </EconomistPanel>
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
      className={`${swsCard} transition-colors ${
        s.isResolved === 1 ? "opacity-60" : "hover:border-brand-green/30"
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
              <StockIdentity name={s.stockName} ticker={s.ticker} href={`/stocks/${s.ticker}`} size="sm" />
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
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResolve(s.id, note);
                      setShowResolveForm(false);
                    }}
                    disabled={isResolving}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors disabled:opacity-50 ${btnPrimary}`}
                  >
                    {isResolving ? "처리 중..." : "확인 완료"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResolveForm(false)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-sm transition-colors ${btnNeutral}`}
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

