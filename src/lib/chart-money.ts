import { formatMoney, type BaseCurrency, type FxRates } from "@/lib/format-money";

/** Recharts Y축 — KRW 정본 금액을 기준통화로 축약 표시 */
export function formatChartAxisKrw(
  valueKrw: number,
  baseCurrency: BaseCurrency,
  fx: FxRates
): string {
  if (baseCurrency === "KRW") {
    const abs = Math.abs(valueKrw);
    if (abs >= 1e8) return `${(valueKrw / 1e8).toFixed(1)}억`;
    if (abs >= 1e4) return `${(valueKrw / 1e4).toFixed(0)}만`;
    return String(Math.round(valueKrw));
  }
  const full = formatMoney(valueKrw, baseCurrency, fx);
  if (full.length <= 12) return full;
  const abs = Math.abs(valueKrw);
  if (baseCurrency === "USD" && fx.usdKrw > 0) {
    const usd = valueKrw / fx.usdKrw;
    if (Math.abs(usd) >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
    if (Math.abs(usd) >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
    return `$${Math.round(usd)}`;
  }
  if (baseCurrency === "JPY" && fx.jpyKrw && fx.jpyKrw > 0) {
    const jpy = valueKrw / fx.jpyKrw;
    if (Math.abs(jpy) >= 1e8) return `¥${(jpy / 1e8).toFixed(1)}億`;
    if (Math.abs(jpy) >= 1e4) return `¥${(jpy / 1e4).toFixed(0)}万`;
    return `¥${Math.round(jpy)}`;
  }
  return full;
}
