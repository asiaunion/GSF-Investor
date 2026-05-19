/**
 * Portfolio risk/return metrics from price return series (daily closes).
 */

export function dailyReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev > 0) out.push((prices[i] - prev) / prev);
  }
  return out;
}

export function volatilityAnnualized(dailyRets: number[]): number | null {
  if (dailyRets.length < 2) return null;
  const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length;
  const variance =
    dailyRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyRets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function maxDrawdownPct(prices: number[]): number | null {
  if (prices.length < 2) return null;
  let peak = prices[0];
  let maxDd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = peak > 0 ? (peak - p) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd * 100;
}

export function periodReturnPct(prices: number[]): number | null {
  if (prices.length < 2) return null;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

export function sharpeRatio(
  dailyRets: number[],
  riskFreeDaily = 0
): number | null {
  if (dailyRets.length < 5) return null;
  const excess = dailyRets.map((r) => r - riskFreeDaily);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance =
    excess.reduce((s, r) => s + (r - mean) ** 2, 0) / (excess.length - 1);
  const std = Math.sqrt(variance);
  if (std < 1e-12) return null;
  return (mean / std) * Math.sqrt(252);
}
