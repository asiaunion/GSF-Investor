import { auth } from "@/auth";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
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
    .orderBy(desc(tradeJournal.tradedAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    stockId,
    tradedAt,
    action,
    quantity,
    price,
    currency = "KRW",
    thesis,
    category = "Core",
    emotionTag,
    retrospective,
  } = body;

  // 필수 필드 검증
  if (!stockId || !tradedAt || !action || !quantity || !price || !thesis) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }
  if (!["BUY", "SELL", "INIT"].includes(action)) {
    return NextResponse.json({ error: "action은 BUY/SELL/INIT 중 하나" }, { status: 400 });
  }

  const [inserted] = await db
    .insert(tradeJournal)
    .values({
      stockId: Number(stockId),
      tradedAt,
      action,
      quantity: Number(quantity),
      price: Number(price),
      currency,
      thesis,
      category,
      emotionTag: emotionTag || null,
      retrospective: retrospective || null,
    })
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}
