import { auth } from "@/auth";
import { db } from "@/db";
import { stockLoans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET: 전체 대출 목록
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.run(sql`
    SELECT l.id, l.stock_id, s.ticker, l.label, l.loan_amount, l.interest_rate,
           l.started_at, l.is_active, l.note, l.created_at
    FROM stock_loans l
    LEFT JOIN stocks s ON s.id = l.stock_id
    ORDER BY l.created_at DESC
  `);

  const loans = rows.rows.map((r) => ({
    id: Number(r[0]),
    stockId: r[1] ? Number(r[1]) : null,
    ticker: r[2] ? String(r[2]) : null,
    label: String(r[3]),
    loanAmount: Number(r[4]),
    interestRate: Number(r[5]),
    startedAt: r[6] ? String(r[6]) : null,
    isActive: Number(r[7]),
    note: r[8] ? String(r[8]) : null,
    createdAt: String(r[9]),
    // 파생 계산
    annualInterest: Number(r[4]) * Number(r[5]) / 100,
    monthlyInterest: Number(r[4]) * Number(r[5]) / 100 / 12,
  }));

  return NextResponse.json(loans);
}

// POST: 대출 추가
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { stockId, label, loanAmount, interestRate, startedAt, note } = body;

  if (!loanAmount || !interestRate) {
    return NextResponse.json({ error: "loanAmount, interestRate 필수" }, { status: 400 });
  }

  await db.insert(stockLoans).values({
    stockId: stockId ?? null,
    label: label ?? "주식담보대출",
    loanAmount: Number(loanAmount),
    interestRate: Number(interestRate),
    startedAt: startedAt ?? null,
    note: note ?? null,
    isActive: 1,
  });

  return NextResponse.json({ ok: true });
}

// PATCH: 대출 수정 (isActive 토글 포함)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (updates.label !== undefined)        updateData.label = updates.label;
  if (updates.loanAmount !== undefined)   updateData.loanAmount = Number(updates.loanAmount);
  if (updates.interestRate !== undefined) updateData.interestRate = Number(updates.interestRate);
  if (updates.startedAt !== undefined)    updateData.startedAt = updates.startedAt;
  if (updates.note !== undefined)         updateData.note = updates.note;
  if (updates.isActive !== undefined)     updateData.isActive = updates.isActive ? 1 : 0;

  await db.update(stockLoans).set(updateData).where(eq(stockLoans.id, id));
  return NextResponse.json({ ok: true });
}

// DELETE: 대출 삭제
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  await db.delete(stockLoans).where(eq(stockLoans.id, id));
  return NextResponse.json({ ok: true });
}
