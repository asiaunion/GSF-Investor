import { auth } from "@/auth";
import { db } from "@/db";
import { wealthPositions } from "@/db/schema";
import { inferBigCategory, isLiabilityCategory } from "@/lib/wealth-categories";
import { fetchWealthPositions } from "@/lib/net-worth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const positions = await fetchWealthPositions();
  return NextResponse.json(positions);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const category = String(body.category ?? "").trim();
  const name = String(body.name ?? "").trim();
  const valueKrw = Number(body.valueKrw);

  if (!category || !name || !Number.isFinite(valueKrw)) {
    return NextResponse.json(
      { error: "category, name, valueKrw 필수" },
      { status: 400 }
    );
  }

  if (category === "예수금" && !String(body.broker ?? "").trim()) {
    return NextResponse.json({ error: "예수금은 증권사(broker) 필수" }, { status: 400 });
  }

  const bigCategory = inferBigCategory(category);
  const isLiability = body.isLiability != null ? (body.isLiability ? 1 : 0) : isLiabilityCategory(category) ? 1 : 0;

  const result = await db
    .insert(wealthPositions)
    .values({
      category,
      bigCategory,
      broker: body.broker?.trim() || null,
      name,
      ticker: body.ticker?.trim() || null,
      quantity: body.quantity != null ? Number(body.quantity) : 1,
      bookValue: body.bookValue != null ? Number(body.bookValue) : null,
      valueKrw,
      currency: body.currency ?? "KRW",
      isLiability,
      note: body.note?.trim() || null,
      isActive: 1,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: wealthPositions.id });

  return NextResponse.json({ ok: true, id: result[0]?.id });
}
