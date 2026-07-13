import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { stockId, action, conviction, fairValueLocal, expectedReturnPct, nextCatalyst, thesisSummary } = body;

  if (!stockId || !action) {
    return NextResponse.json({ error: "stockId and action required" }, { status: 400 });
  }

  await db.run(sql`
    INSERT INTO stock_thesis (stock_id, action, conviction, fair_value_local, expected_return_pct, next_catalyst, thesis_summary, updated_at)
    VALUES (${stockId}, ${action}, ${conviction ?? null}, ${fairValueLocal ?? null}, ${expectedReturnPct ?? null}, ${nextCatalyst ?? null}, ${thesisSummary ?? null}, datetime('now'))
    ON CONFLICT(stock_id) DO UPDATE SET
      action = excluded.action,
      conviction = excluded.conviction,
      fair_value_local = excluded.fair_value_local,
      expected_return_pct = excluded.expected_return_pct,
      next_catalyst = excluded.next_catalyst,
      thesis_summary = excluded.thesis_summary,
      updated_at = excluded.updated_at
  `);

  return NextResponse.json({ ok: true });
}
