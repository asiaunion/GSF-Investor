import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <span className="font-semibold text-white">GSF Investor</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/journal" className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors">
              매매 일지
            </Link>
            <span className="text-xs text-zinc-600 hidden sm:block">{session.user?.email}</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Status */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-1">포트폴리오 대시보드</h1>
          <p className="text-zinc-400">Phase 1 세팅 완료 — Day 3 시드 데이터 투입 준비 중</p>
        </div>

        {/* Phase Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: "총 자산", value: "—", sub: "시드 데이터 투입 전", color: "emerald" },
            { label: "총 수익률", value: "—%", sub: "매매일지 입력 후 계산", color: "blue" },
            { label: "시그널", value: "0건", sub: "미확인 없음", color: "amber" },
          ].map((card) => (
            <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <p className="text-sm text-zinc-400 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-zinc-600 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Phase 1 Roadmap */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Phase 1 진행 상황</h2>
          <div className="space-y-3">
            {[
              { day: "Day 1-2", task: "리포 + Next.js + Turso + Drizzle + NextAuth", done: true },
              { day: "Day 3", task: "seed_portfolio.py — 종목 시딩 + INIT + 2년 주가·8분기 재무", done: true },
              { day: "Day 4-5", task: "매매 일지 CRUD + 테제 필수 입력 + 감정 태그", done: true },
              { day: "Day 6-7", task: "daily_price.py + GitHub Actions 크론", done: false },
              { day: "Day 8-9", task: "포트폴리오 대시보드 v_portfolio View 연동", done: false },
              { day: "Day 10-11", task: "종목 상세 페이지 (Overview + 재무 차트)", done: false },
            ].map((item) => (
              <div key={item.day} className="flex items-center gap-4">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.done
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : "bg-zinc-800 border border-zinc-700"
                  }`}
                >
                  {item.done && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-zinc-500 mr-2">{item.day}</span>
                  <span className={`text-sm ${item.done ? "text-zinc-300" : "text-zinc-500"}`}>{item.task}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
