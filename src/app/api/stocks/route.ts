import { auth } from "@/auth";
import { db } from "@/db";
import { stocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: stocks.id,
      ticker: stocks.ticker,
      name: stocks.name,
      market: stocks.market,
      category: stocks.category,
    })
    .from(stocks)
    .where(eq(stocks.isActive, 1));

  return NextResponse.json(rows);
}
