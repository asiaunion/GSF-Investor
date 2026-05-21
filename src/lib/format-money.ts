/** KRW 정본 금액을 기준 통화로 표시 (Week 2 — 환율은 호출측에서 전달) */

export type FxRates = {
  usdKrw: number;
  jpyKrw?: number | null;
};

export type BaseCurrency = "KRW" | "USD" | "JPY";

export function formatMoney(
  amountKrw: number,
  baseCurrency: BaseCurrency,
  rates: FxRates
): string {
  const krw = Math.round(amountKrw);
  if (baseCurrency === "KRW" || !Number.isFinite(krw)) {
    return new Intl.NumberFormat("ko-KR").format(krw) + "원";
  }
  if (baseCurrency === "USD") {
    const rate = rates.usdKrw > 0 ? rates.usdKrw : 1350;
    const usd = krw / rate;
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(usd) + " (₩)"
    );
  }
  const jpyRate = rates.jpyKrw && rates.jpyKrw > 0 ? rates.jpyKrw : null;
  if (!jpyRate) {
    return new Intl.NumberFormat("ko-KR").format(krw) + "원 (JPY 환율 없음)";
  }
  const jpy = krw / jpyRate;
  return (
    new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(jpy) + " (₩)"
  );
}
