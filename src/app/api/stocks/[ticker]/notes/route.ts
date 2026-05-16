import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST: 메모 작성
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticker } = await params;
  const body = await req.json();
  const { contentMd } = body;

  if (!contentMd || contentMd.trim() === "") {
    return NextResponse.json({ error: "내용을 입력하세요" }, { status: 400 });
  }

  // stock_id 조회
  const stockRow = await db.run(sql`
    SELECT id FROM stocks WHERE ticker = ${ticker} AND is_active = 1 LIMIT 1
  `);

  if (stockRow.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stockId = Number(stockRow.rows[0][0]);

  await db.run(sql`
    INSERT INTO stock_notes (stock_id, content_md, created_at, updated_at)
    VALUES (${stockId}, ${contentMd.trim()}, datetime('now'), datetime('now'))
  `);

  return NextResponse.json({ ok: true });
}
