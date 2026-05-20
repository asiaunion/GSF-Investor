import { auth } from "@/auth";
import { computeNetWorth } from "@/lib/net-worth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await computeNetWorth();
  return NextResponse.json(summary);
}
