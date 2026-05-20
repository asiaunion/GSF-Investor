import { auth } from "@/auth";
import { db } from "@/db";
import { wealthPositions } from "@/db/schema";
import { inferBigCategory, isLiabilityCategory } from "@/lib/wealth-categories";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const positionId = Number(id);
  if (!positionId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json();
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (body.category !== undefined) {
    const category = String(body.category).trim();
    updateData.category = category;
    updateData.bigCategory = inferBigCategory(category);
    if (body.isLiability === undefined) {
      updateData.isLiability = isLiabilityCategory(category) ? 1 : 0;
    }
  }
  if (body.broker !== undefined) updateData.broker = body.broker?.trim() || null;
  if (body.name !== undefined) updateData.name = String(body.name).trim();
  if (body.ticker !== undefined) updateData.ticker = body.ticker?.trim() || null;
  if (body.quantity !== undefined) updateData.quantity = Number(body.quantity);
  if (body.bookValue !== undefined) updateData.bookValue = body.bookValue != null ? Number(body.bookValue) : null;
  if (body.valueKrw !== undefined) updateData.valueKrw = Number(body.valueKrw);
  if (body.currency !== undefined) updateData.currency = body.currency;
  if (body.isLiability !== undefined) updateData.isLiability = body.isLiability ? 1 : 0;
  if (body.note !== undefined) updateData.note = body.note?.trim() || null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0;

  if (updateData.category === "예수금" && !updateData.broker) {
    const existing = await db
      .select({ broker: wealthPositions.broker })
      .from(wealthPositions)
      .where(eq(wealthPositions.id, positionId))
      .limit(1);
    if (!existing[0]?.broker && body.broker === "") {
      return NextResponse.json({ error: "예수금은 증권사(broker) 필수" }, { status: 400 });
    }
  }

  await db.update(wealthPositions).set(updateData).where(eq(wealthPositions.id, positionId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const positionId = Number(id);
  if (!positionId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  await db.delete(wealthPositions).where(eq(wealthPositions.id, positionId));
  return NextResponse.json({ ok: true });
}
