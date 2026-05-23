import type { ReactNode } from "react";
import Link from "next/link";
import { linkMuted } from "@/lib/economist-ui";

export type StockIdentityProps = {
  name: string;
  ticker: string;
  /** 상세 링크 — 없으면 텍스트만 */
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** 이름 옆 인라인 메타 (보유, 시장 배지 등) */
  trailing?: ReactNode;
};

const nameSize = {
  sm: "text-sm font-semibold text-text-primary leading-snug",
  md: "text-base font-semibold text-text-primary leading-snug",
  lg: "text-lg font-bold text-text-primary leading-tight",
} as const;

const tickerSize = {
  sm: "text-[11px] text-text-muted font-mono tabular-nums",
  md: "text-xs text-text-muted font-mono tabular-nums",
  lg: "text-sm text-text-muted font-mono tabular-nums",
} as const;

/**
 * 종목 표시 규칙: 종목명(메인) + 종목코드(서브). 코드를 크게 쓰지 않음.
 */
export default function StockIdentity({
  name,
  ticker,
  href,
  size = "md",
  className = "",
  trailing,
}: StockIdentityProps) {
  const displayName = name?.trim() || ticker;
  const body = (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <span className={`truncate ${nameSize[size]}`}>{displayName}</span>
        {trailing}
      </div>
      {ticker && displayName !== ticker && (
        <span className={`${tickerSize[size]} mt-0.5`}>{ticker}</span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`${linkMuted} block min-w-0 hover:opacity-90`}>
        {body}
      </Link>
    );
  }
  return body;
}
