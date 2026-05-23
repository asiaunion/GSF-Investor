import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BaseCurrency, FxRates } from "@/lib/format-money";

export type DisplayCurrency = {
  baseCurrency: BaseCurrency;
  fx: FxRates;
};

/** Settings 기준 통화 + 최신 USDKRW/JPYKRW (서버 컴포넌트용) */
export async function fetchDisplayCurrency(): Promise<DisplayCurrency> {
  const usdRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  const jpyRow = await db.run(sql`
    SELECT rate FROM exchange_rates WHERE pair = 'JPYKRW' ORDER BY date DESC LIMIT 1
  `).catch(() => ({ rows: [] }));

  const usdKrw = usdRow.rows.length > 0 ? Number(usdRow.rows[0][0]) : 1350;
  const jpyKrw = jpyRow.rows.length > 0 ? Number(jpyRow.rows[0][0]) : null;

  let baseCurrency: BaseCurrency = "KRW";
  try {
    const rows = await db
      .select({ baseCurrency: userPreferences.baseCurrency })
      .from(userPreferences)
      .where(eq(userPreferences.id, 1));
    const c = rows[0]?.baseCurrency;
    if (c === "KRW" || c === "USD" || c === "JPY") baseCurrency = c;
  } catch {
    /* table missing on old DB */
  }

  return { baseCurrency, fx: { usdKrw, jpyKrw } };
}
