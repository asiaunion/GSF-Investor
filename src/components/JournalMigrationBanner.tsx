import Link from "next/link";
import { economistCard } from "@/lib/economist-ui";

type Props = {
  journalCount: number;
  portfolioPositionCount: number;
};

export default function JournalMigrationBanner({
  journalCount,
  portfolioPositionCount,
}: Props) {
  const needsInit = portfolioPositionCount === 0;
  if (!needsInit) return null;

  return (
    <div className={`${economistCard} p-4 border-l-4 border-l-brand-green`}>
      <h2 className="text-sm font-bold text-text-primary mb-2">
        Portfolio 통합 — 주식 포지션 재입력
      </h2>
      <p className="text-xs text-text-secondary leading-relaxed mb-3">
        비주식·부채는 <Link href="/wealth" className="text-brand-green hover:underline">전체 자산</Link>
        에 반영되었습니다. 주식 평가는 매매 일지의 <strong>INIT</strong> 거래로만 집계됩니다.
        {journalCount > 0
          ? " 일지에 거래는 있으나 보유 포지션이 없습니다 — INIT(수량·평균단가)를 확인하세요."
          : " 아직 일지가 비어 있으면 종목별 INIT부터 입력하세요."}
      </p>
      <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside mb-3">
        <li>
          <Link href="/settings" className="text-brand-green hover:underline">
            설정
          </Link>
          에서 관심 종목·yahoo_ticker 확인
        </li>
        <li>매매 일지 → 종목별 INIT (증권사·수량·평균단가·통화)</li>
        <li>
          <Link href="/" className="text-brand-green hover:underline">
            대시보드
          </Link>
          ·{" "}
          <Link href="/wealth" className="text-brand-green hover:underline">
            전체 자산
          </Link>
          에 주식 평가·순자산 반영 확인
        </li>
      </ol>
      <p className="text-[11px] text-text-muted">
        상세: docs/operations/wealth-migration-report.md
      </p>
    </div>
  );
}
