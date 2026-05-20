/**
 * FY-based valuation metrics (aligned with stock detail page / API).
 * Discover checklist uses the same rules — no TTM PER fallback.
 */

export type FinancialRow = {
  period: string;
  eps?: number | null;
  bps?: number | null;
  netIncome?: number | null;
  totalEquity?: number | null;
  dividendPerShare?: number | null;
  roe?: number | null;
};

export function findLatestFy<T extends { period: string }>(rows: T[]): T | null {
  return rows.find((f) => f.period.endsWith("FY")) ?? null;
}

export function computeRoe(
  netIncome: number | null | undefined,
  totalEquity: number | null | undefined,
  storedRoe?: number | null
): number | null {
  if (storedRoe != null) return storedRoe;
  if (netIncome == null || totalEquity == null || totalEquity <= 0) return null;
  return (netIncome / totalEquity) * 100;
}

/** PER = price / FY EPS only (no TTM). */
export function computePerFy(
  price: number | null | undefined,
  fins: FinancialRow[]
): number | null {
  const fy = findLatestFy(fins);
  const eps = fy?.eps;
  if (price == null || eps == null || eps <= 0) return null;
  return price / eps;
}

export function computePbrFy(
  price: number | null | undefined,
  fins: FinancialRow[]
): number | null {
  const fy = findLatestFy(fins);
  const bps = fy?.bps;
  if (price == null || bps == null || bps <= 0) return null;
  return price / bps;
}

export function computeDividendYieldFy(
  price: number | null | undefined,
  fins: FinancialRow[]
): number | null {
  const fy = findLatestFy(fins);
  const dps = fy?.dividendPerShare;
  if (price == null || dps == null || dps <= 0) return null;
  return (dps / price) * 100;
}

export function computeRoeFy(fins: FinancialRow[]): number | null {
  const fy = findLatestFy(fins);
  if (!fy) return null;
  return computeRoe(fy.netIncome, fy.totalEquity, fy.roe);
}

export type ValuationBasis = {
  perBasis: "FY";
  fyPeriod: string | null;
};

export function valuationBasisFromFins(fins: FinancialRow[]): ValuationBasis {
  const fy = findLatestFy(fins);
  return { perBasis: "FY", fyPeriod: fy?.period ?? null };
}
