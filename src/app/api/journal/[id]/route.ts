import { auth } from "@/auth";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import type { NewTradeJournal } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select({
      id: tradeJournal.id,
      stockId: tradeJournal.stockId,
      ticker: stocks.ticker,
      name: stocks.name,
      market: stocks.market,
      tradedAt: tradeJournal.tradedAt,
      action: tradeJournal.action,
      quantity: tradeJournal.quantity,
      price: tradeJournal.price,
      currency: tradeJournal.currency,
      thesis: tradeJournal.thesis,
      category: tradeJournal.category,
      emotionTag: tradeJournal.emotionTag,
      retrospective: tradeJournal.retrospective,
      createdAt: tradeJournal.createdAt,
    })
    .from(tradeJournal)
    .leftJoin(stocks, eq(tradeJournal.stockId, stocks.id))
    .where(eq(tradeJournal.id, Number(id)));

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updateData: Partial<NewTradeJournal> = {};
  const allowed = [
    "tradedAt", "action", "quantity", "price", "currency",
    "thesis", "category", "emotionTag", "retrospective",
  ];

  for (const key of allowed) {
    if (key in body) {
      (updateData as Record<string, unknown>)[key] = body[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "변경 필드 없음" }, { status: 400 });
  }

  const [updated] = await db
    .update(tradeJournal)
    .set(updateData)
    .where(eq(tradeJournal.id, Number(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(tradeJournal).where(eq(tradeJournal.id, Number(id)));
  return NextResponse.json({ ok: true });
}
