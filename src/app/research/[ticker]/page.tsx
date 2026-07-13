import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";

export default async function ResearchTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { ticker } = await params;

  return (
    <AppPageLayout
      email={session.user?.email}
      title={ticker.toUpperCase()}
      subtitle="종목 딥다이브 — Thesis · AI Report · Signals · Notes"
    >
      <div className="flex flex-col items-center justify-center py-24 text-text-muted">
        <p className="text-lg font-medium">곧 제공됩니다</p>
        <p className="text-sm mt-1">{ticker.toUpperCase()} 종목 상세 분석 페이지</p>
      </div>
    </AppPageLayout>
  );
}
