import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const signalId = parseInt(id, 10);
  if (isNaN(signalId)) {
    return Response.json({ error: "Invalid signal id" }, { status: 400 });
  }

  let note = "";
  try {
    const body = await req.json();
    note = body.note ?? "";
  } catch {}

  try {
    await db.run(sql`
      UPDATE signals
      SET is_resolved = 1,
          resolved_note = ${note || null}
      WHERE id = ${signalId}
    `);
    return Response.json({ success: true });
  } catch (e) {
    console.error("[api/signals/resolve]", e);
    return Response.json({ error: "DB update failed" }, { status: 500 });
  }
}
