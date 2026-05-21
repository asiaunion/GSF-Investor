import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 허용된 기준 통화 목록
const ALLOWED_CURRENCIES = ["KRW", "USD", "JPY"];

/**
 * GET /api/user/preferences
 * 
 * id = 1인 사용자의 baseCurrency 설정을 반환합니다.
 * 레코드가 존재하지 않을 시 기본값(KRW)을 가진 레코드를 즉시 생성합니다.
 */
export async function GET(req: NextRequest) {
  let session = await auth();
  if (process.env.DEV_PREVIEW_AUTH === "true") {
    session = session || {
      user: { email: "preview@gsf-investor.local", name: "Design Preview" },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.id, 1))
      .then((rows) => rows[0]);

    // 레코드가 없으면 기본값으로 삽입
    if (!prefs) {
      await db.insert(userPreferences).values({
        id: 1,
        baseCurrency: "KRW",
      });
      
      prefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.id, 1))
        .then((rows) => rows[0]);
    }

    return NextResponse.json(prefs);
  } catch (error: any) {
    console.error("[PREFERENCES GET ERROR]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/user/preferences
 * 
 * baseCurrency 설정을 수정합니다.
 */
export async function PATCH(req: NextRequest) {
  let session = await auth();
  if (process.env.DEV_PREVIEW_AUTH === "true") {
    session = session || {
      user: { email: "preview@gsf-investor.local", name: "Design Preview" },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { baseCurrency } = body;

    if (!baseCurrency || !ALLOWED_CURRENCIES.includes(baseCurrency)) {
      return NextResponse.json(
        { error: `Invalid currency. Allowed: ${ALLOWED_CURRENCIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Upsert 처리 (SQLite는 insert ... onConflictDoUpdate 형태 지원)
    // 여기서는 id=1 레코드가 존재하는지 먼저 확인 후 update 또는 insert 처리합니다.
    const exists = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.id, 1))
      .then((rows) => rows[0]);

    if (exists) {
      await db
        .update(userPreferences)
        .set({
          baseCurrency,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userPreferences.id, 1));
    } else {
      await db.insert(userPreferences).values({
        id: 1,
        baseCurrency,
      });
    }

    const updated = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.id, 1))
      .then((rows) => rows[0]);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[PREFERENCES PATCH ERROR]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
