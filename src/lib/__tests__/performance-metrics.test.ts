import { describe, expect, it } from "vitest";
import {
  dailyReturns,
  maxDrawdownPct,
  periodReturnPct,
  volatilityAnnualized,
} from "../performance-metrics";

describe("performance-metrics", () => {
  it("computes period return and MDD", () => {
    const prices = [100, 110, 105, 120];
    expect(periodReturnPct(prices)).toBeCloseTo(20, 1);
    expect(maxDrawdownPct(prices)).toBeGreaterThan(0);
  });

  it("computes volatility from daily returns", () => {
    const prices = [100, 101, 99, 102, 100];
    const rets = dailyReturns(prices);
    expect(volatilityAnnualized(rets)).not.toBeNull();
  });
});
