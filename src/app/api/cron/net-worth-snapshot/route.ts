import { db } from "@/db";
import { netWorthSnapshots } from "@/db/schema";
import { computeNetWorth } from "@/lib/net-worth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (
    process.env.NODE_ENV === "production" &&
    (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await computeNetWorth();

    await db.insert(netWorthSnapshots).values({
      totalAssets: summary.totalAssetsKrw,
      totalDebt: summary.totalDebtKrw,
      netWorth: summary.netWorthKrw,
      securitiesKrw: summary.securitiesKrw,
      wealthAssetsKrw: summary.wealthAssetsKrw,
      liabilitiesKrw: summary.liabilitiesKrw,
      breakdownJson: JSON.stringify({
        stockLoansKrw: summary.stockLoansKrw,
        wealthLiabilitiesKrw: summary.wealthLiabilitiesKrw,
        positionCount: summary.positions.length,
      }),
    });

    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
      const message =
        `📊 [GSF 순자산 스냅샷]\n\n` +
        `💰 순자산: ${fmt(summary.netWorthKrw)}원\n` +
        `🔺 총자산: ${fmt(summary.totalAssetsKrw)}원\n` +
        `🔻 총부채: ${fmt(summary.totalDebtKrw)}원\n` +
        `(주식 ${fmt(summary.securitiesKrw)} / 비주식자산 ${fmt(summary.wealthAssetsKrw)})`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
    }

    return NextResponse.json({
      success: true,
      netWorth: summary.netWorthKrw,
      totalAssets: summary.totalAssetsKrw,
      totalDebt: summary.totalDebtKrw,
    });
  } catch (e) {
    console.error("[cron/net-worth-snapshot]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
