import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 미확인 HIGH 시그널 수 (배지용)
    const unresolvedRows = await db.run(sql`
      SELECT COUNT(*) AS cnt
      FROM signals
      WHERE is_resolved = 0 AND severity = 'HIGH'
    `);
    const unresolvedCount = Number(unresolvedRows.rows[0]?.[0] ?? 0);

    return Response.json({ unresolvedCount });
  } catch (e) {
    console.error("[api/signals/badge]", e);
    return Response.json({ unresolvedCount: 0 });
  }
}
