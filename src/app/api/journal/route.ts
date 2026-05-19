import { auth } from "@/auth";
import { db } from "@/db";
import { tradeJournal, stocks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { journalCreateSchema, validationErrorResponse } from "@/lib/validations";

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
      loanInterest: tradeJournal.loanInterest,
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

  const parsed = journalCreateSchema.safeParse(await req.json());
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const {
    stockId,
    tradedAt,
    action,
    quantity,
    price,
    currency,
    thesis,
    category,
    emotionTag,
    confidenceScore,
    loanInterest,
    retrospective,
  } = parsed.data;

  const [inserted] = await db
    .insert(tradeJournal)
    .values({
      stockId,
      tradedAt,
      action,
      quantity,
      price,
      currency,
      thesis,
      category,
      emotionTag: emotionTag ?? null,
      confidenceScore: confidenceScore ?? null,
      loanInterest: loanInterest ?? null,
      retrospective: retrospective ?? null,
    })
    .returning();

  return NextResponse.json(inserted, { status: 201 });
}
