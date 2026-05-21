import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { holdingSnapshots } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/holdings/history
 * 
 * holding_snapshots 테이블에서 날짜(date)별로 모든 보유 종목의 평가금액 및 평가손익의 합을 구합니다.
 * 기간 필터링은 프론트엔드 또는 이 라우트에서 처리할 수 있도록, 오름차순 시계열 전체 데이터를 제공합니다.
 */
export async function GET(req: Request) {
  let session = await auth();
  if (process.env.DEV_PREVIEW_AUTH === "true") {
    session = session || {
      user: { email: "preview@gsf-investor.local", name: "Design Preview" },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await db
      .select({
        date: holdingSnapshots.date,
        totalMarketValue: sql<number>`CAST(SUM(COALESCE(${holdingSnapshots.marketValueKrw}, 0)) AS REAL)`,
        totalUnrealizedPnl: sql<number>`CAST(SUM(COALESCE(${holdingSnapshots.unrealizedPnlKrw}, 0)) AS REAL)`,
      })
      .from(holdingSnapshots)
      .groupBy(holdingSnapshots.date)
      .orderBy(holdingSnapshots.date);

    return NextResponse.json(history);
  } catch (error: any) {
    console.error("[HOLDINGS HISTORY GET ERROR]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
