import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";

export default async function AnalysisPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppPageLayout email={session.user?.email} title="Analysis" subtitle="포트폴리오 분석">
      <div className="flex flex-col items-center justify-center py-24 text-text-muted">
        <p className="text-lg font-medium">곧 제공됩니다</p>
        <p className="text-sm mt-1">섹터 배분, 상관관계, 리스크 분석 예정</p>
      </div>
    </AppPageLayout>
  );
}
