import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AppPageLayout from "@/components/AppPageLayout";
import { economistCard } from "@/lib/economist-ui";

export const dynamic = "force-dynamic";

export default async function DividendsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppPageLayout
      email={session.user?.email}
      title="배당 캘린더"
      subtitle="dividend_events 적재 전 — Phase 2b"
    >
      <div className={`${economistCard} p-8 text-center max-w-lg mx-auto`}>
        <p className="text-4xl mb-4" aria-hidden>
          📅
        </p>
        <h2 className="text-base font-semibold text-text-primary mb-2">데이터 준비 중</h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          <code className="text-brand-green/90">dividend_events</code> 테이블은 생성되었으나,
          배당 일정 적재 파이프라인(데이터 소스 확정)은 Phase 2b로 연기되었습니다.
        </p>
        <p className="text-xs text-text-muted mb-6">
          적재가 완료되면 이 페이지에 배당락·지급일 캘린더와 보유 종목 필터가 표시됩니다.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          <Link href="/" className="text-brand-green hover:underline">
            대시보드
          </Link>
          <Link href="/settings" className="text-brand-green hover:underline">
            설정
          </Link>
          <Link href="/discover" className="text-brand-green hover:underline">
            종목 발굴
          </Link>
        </div>
      </div>
    </AppPageLayout>
  );
}
