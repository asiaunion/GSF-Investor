import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AppPageLayout from "@/components/AppPageLayout";
import { computeNetWorth } from "@/lib/net-worth";
import WealthClient from "./WealthClient";

export const dynamic = "force-dynamic";

export default async function WealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const summary = await computeNetWorth();

  return (
    <AppPageLayout
      email={session.user?.email}
      title="전체 자산"
      subtitle="비주식·부채는 DB에서 직접 수정합니다. 주식은 매매 일지 기준입니다."
      headerExtra={
        <Link
          href="/"
          className="text-sm text-brand-green hover:underline shrink-0"
        >
          주식 대시보드 →
        </Link>
      }
    >
      <WealthClient initial={summary} />
    </AppPageLayout>
  );
}
