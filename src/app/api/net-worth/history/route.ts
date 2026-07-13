import { auth } from "@/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type NetWorthHistoryPoint = {
  date: string;
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  securitiesKrw: number;
  wealthAssetsKrw: number;
  liabilitiesKrw: number;
};

function rangeToDays(range: string): number | null {
  switch (range) {
    case "7D":
      return 7;
    case "1M":
      return 30;
    case "3M":
      return 90;
    case "6M":
      return 180;
    case "1Y":
      return 365;
    case "ALL":
      return null;
    default:
      return 90;
  }
}

function rangeToYTDCutoff(range: string): string | null {
  if (range !== "YTD") return null;
  return `${new Date().getFullYear()}-01-01`;
}

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

  const range = req.nextUrl.searchParams.get("range") ?? "3M";
  const days = rangeToDays(range);
  const ytdCutoff = rangeToYTDCutoff(range);

  try {
    const rows = await db.run(sql`
      SELECT
        created_at,
        net_worth,
        total_assets,
        total_debt,
        securities_krw,
        wealth_assets_krw,
        liabilities_krw
      FROM net_worth_snapshots
      ORDER BY created_at ASC
    `);

    let points: NetWorthHistoryPoint[] = rows.rows.map((r) => {
      const createdAt = String(r[0] ?? "");
      return {
        date: createdAt.slice(0, 10),
        netWorth: Number(r[1] ?? 0),
        totalAssets: Number(r[2] ?? 0),
        totalDebt: Number(r[3] ?? 0),
        securitiesKrw: Number(r[4] ?? 0),
        wealthAssetsKrw: Number(r[5] ?? 0),
        liabilitiesKrw: Number(r[6] ?? 0),
      };
    });

    if (ytdCutoff != null) {
      points = points.filter((p) => p.date >= ytdCutoff);
    } else if (days != null && points.length > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      points = points.filter((p) => p.date >= cutoffStr);
    }

    return NextResponse.json({
      success: true,
      range,
      count: points.length,
      points,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[net-worth/history]", error);
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
