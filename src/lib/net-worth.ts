import { db } from "@/db";
import { sql } from "drizzle-orm";

export type WealthPositionRow = {
  id: number;
  category: string;
  bigCategory: string;
  broker: string | null;
  name: string;
  ticker: string | null;
  quantity: number | null;
  bookValue: number | null;
  valueKrw: number;
  currency: string;
  isLiability: number;
  note: string | null;
};

export type NetWorthSummary = {
  securitiesKrw: number;
  wealthAssetsKrw: number;
  liabilitiesKrw: number;
  stockLoansKrw: number;
  wealthLiabilitiesKrw: number;
  totalAssetsKrw: number;
  totalDebtKrw: number;
  netWorthKrw: number;
  usdKrw: number;
  fxDate: string | null;
  positions: WealthPositionRow[];
};

export async function fetchWealthPositions(): Promise<WealthPositionRow[]> {
  const rows = await db.run(sql`
    SELECT id, category, big_category, broker, name, ticker, quantity, book_value,
           value_krw, currency, is_liability, note
    FROM wealth_positions
    WHERE is_active = 1
    ORDER BY big_category, category, broker, name
  `);
  return rows.rows.map((r) => ({
    id: Number(r[0]),
    category: String(r[1]),
    bigCategory: String(r[2]),
    broker: r[3] != null ? String(r[3]) : null,
    name: String(r[4]),
    ticker: r[5] != null ? String(r[5]) : null,
    quantity: r[6] != null ? Number(r[6]) : null,
    bookValue: r[7] != null ? Number(r[7]) : null,
    valueKrw: Number(r[8]),
    currency: String(r[9] ?? "KRW"),
    isLiability: Number(r[10] ?? 0),
    note: r[11] != null ? String(r[11]) : null,
  }));
}

export async function computeNetWorth(): Promise<NetWorthSummary> {
  const fxRow = await db.run(sql`
    SELECT rate, date FROM exchange_rates WHERE pair = 'USDKRW' ORDER BY date DESC LIMIT 1
  `);
  const usdKrw = fxRow.rows.length > 0 ? Number(fxRow.rows[0][0]) : 1300;
  const fxDate = fxRow.rows.length > 0 ? String(fxRow.rows[0][1]) : null;

  const holdings = await db.run(sql`
    SELECT vp.quantity, vp.avg_price, vp.currency, p.close_price
    FROM v_portfolio vp
    JOIN stocks s ON s.ticker = vp.ticker
    LEFT JOIN (
      SELECT p.stock_id, p.close_price
      FROM prices p
      INNER JOIN (
        SELECT stock_id, MAX(date) AS max_date FROM prices GROUP BY stock_id
      ) latest ON p.stock_id = latest.stock_id AND p.date = latest.max_date
    ) p ON p.stock_id = s.id
  `).catch(() => ({ rows: [] }));

  let securitiesKrw = 0;
  for (const row of holdings.rows) {
    const qty = Number(row[0]);
    const avg = Number(row[1]);
    const currency = String(row[2]);
    const close = row[3] != null ? Number(row[3]) : avg;
    const local = close * qty;
    securitiesKrw += currency === "USD" ? local * usdKrw : local;
  }

  const positions = await fetchWealthPositions();
  let wealthAssetsKrw = 0;
  let wealthLiabilitiesKrw = 0;
  for (const p of positions) {
    if (p.isLiability) wealthLiabilitiesKrw += p.valueKrw;
    else wealthAssetsKrw += p.valueKrw;
  }

  const loanRows = await db.run(sql`
    SELECT COALESCE(SUM(loan_amount), 0) FROM stock_loans WHERE is_active = 1
  `).catch(() => ({ rows: [[0]] }));
  const stockLoansKrw = Number(loanRows.rows[0]?.[0] ?? 0);

  const liabilitiesKrw = wealthLiabilitiesKrw + stockLoansKrw;
  const totalAssetsKrw = securitiesKrw + wealthAssetsKrw;
  const totalDebtKrw = liabilitiesKrw;
  const netWorthKrw = totalAssetsKrw - totalDebtKrw;

  return {
    securitiesKrw,
    wealthAssetsKrw,
    liabilitiesKrw,
    stockLoansKrw,
    wealthLiabilitiesKrw,
    totalAssetsKrw,
    totalDebtKrw,
    netWorthKrw,
    usdKrw,
    fxDate,
    positions,
  };
}

export function formatKrw(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
}
