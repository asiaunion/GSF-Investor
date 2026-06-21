import { describe, it, expect } from "vitest";
import { factCheckReport, type FinancialData } from "../gemini";

const mockFin: FinancialData = {
  period: "2024FY",
  revenue: 302_256_000_000_000, // 302조원
  opIncome: 32_724_000_000_000,
  netIncome: 26_000_000_000_000,
  debtRatio: 35.2,
  eps: 3869,
  bps: 52000,
  roe: 8.5,
  dividendPerShare: 1444,
  freeCashFlow: null,
  source: "DART",
};

describe("factCheckReport — 단위 스케일 보정", () => {
  it("억원 단위로 표기된 매출을 verified로 검증한다", () => {
    // 302조원 → 3,022,560억원 → 보고서에 '3,022,560억원'으로 표기된 경우
    const reportMd = "매출은 3,022,560억원을 기록했으며 전년 대비 성장했습니다.";
    const result = factCheckReport(reportMd, [mockFin]);
    const revenueItem = result.items.find((i) => i.label.includes("매출"));
    expect(revenueItem?.status).toBe("verified");
  });

  it("조원 단위로 표기된 매출도 verified로 검증한다", () => {
    // 302조원 → 보고서에 '302조원'으로 표기
    const reportMd = "삼성전자의 연간 매출액은 302조원에 달합니다.";
    const result = factCheckReport(reportMd, [mockFin]);
    const revenueItem = result.items.find((i) => i.label.includes("매출"));
    expect(revenueItem?.status).toBe("verified");
  });

  it("EPS처럼 단위 변환 없이 그대로 쓰이는 값도 verified로 검증한다", () => {
    const reportMd = "EPS는 3,869원으로 전년 대비 소폭 감소했습니다.";
    const result = factCheckReport(reportMd, [mockFin]);
    const epsItem = result.items.find((i) => i.label.includes("EPS"));
    expect(epsItem?.status).toBe("verified");
  });

  it("보고서에 해당 숫자가 없으면 not_found를 반환한다", () => {
    const reportMd = "실적은 전반적으로 양호합니다."; // 구체 수치 없음
    const result = factCheckReport(reportMd, [mockFin]);
    expect(result.items.every((i) => i.status === "not_found")).toBe(true);
  });

  it("재무 데이터가 없으면 빈 결과를 반환한다", () => {
    const result = factCheckReport("아무 보고서", []);
    expect(result.totalChecked).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});
