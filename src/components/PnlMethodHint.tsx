"use client";

/** Explains weighted-average (dashboard) vs FIFO (journal analytics) */
export function PnlMethodHint({
  method,
  className = "",
}: {
  method: "weighted_avg" | "fifo";
  className?: string;
}) {
  const title =
    method === "weighted_avg"
      ? "가중평균 매입단가 기준"
      : "FIFO(선입선출) 실현손익 기준";
  const detail =
    method === "weighted_avg"
      ? "보유 종목의 수익률·평가금액은 매매 일지에서 계산한 가중평균 단가(v_portfolio)를 사용합니다. 매도 실현손익과는 다를 수 있습니다."
      : "매도 거래별로 가장 먼저 매수한 lot부터 매칭하여 실현손익·승률을 계산합니다. 대시보드 보유 수익률과는 기준이 다릅니다.";

  return (
    <span
      className={`inline-flex items-center gap-1 text-text-muted cursor-help ${className}`}
      title={`${title}. ${detail}`}
      aria-label={detail}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="text-[10px] underline decoration-dotted">{title}</span>
    </span>
  );
}
