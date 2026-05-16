import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const reportId = Number(id);
  if (!reportId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const rows = await db.run(sql`
    SELECT r.id, r.stock_id, s.ticker, s.name, r.trigger, r.content_md, r.charts_json, r.generated_at
    FROM reports r
    JOIN stocks s ON s.id = r.stock_id
    WHERE r.id = ${reportId}
    LIMIT 1
  `);

  if (!rows.rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const r = rows.rows[0];
  return NextResponse.json({
    id: Number(r[0]),
    stock_id: Number(r[1]),
    ticker: String(r[2]),
    stock_name: String(r[3]),
    trigger: String(r[4]),
    content_md: String(r[5] ?? ""),
    charts_json: r[6] ? String(r[6]) : null,
    generated_at: String(r[7]),
  });
}
