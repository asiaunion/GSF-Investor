import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getActiveSignalRules } from "@/lib/signal-rules";

export const dynamic = "force-dynamic";

/** GET /api/signal-rules — DB 기반 활성 시그널 규칙 (비어 있으면 기본 시드) */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await getActiveSignalRules();
  return NextResponse.json({ rules });
}
