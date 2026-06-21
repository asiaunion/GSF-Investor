import { describe, it, expect } from "vitest";
import { toObjs, toObj } from "../db-utils";

const mockResult = {
  columns: ["id", "ticker", "close_price"],
  rows: [
    [1, "005930", 75000],
    [2, "AAPL", 180.5],
  ],
};

describe("toObjs", () => {
  it("컬럼명으로 모든 행을 객체로 변환한다", () => {
    const result = toObjs(mockResult);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, ticker: "005930", close_price: 75000 });
    expect(result[1]).toEqual({ id: 2, ticker: "AAPL", close_price: 180.5 });
  });

  it("빈 rows면 빈 배열을 반환한다", () => {
    expect(toObjs({ columns: ["id"], rows: [] })).toEqual([]);
  });
});

describe("toObj", () => {
  it("기본값(idx=0)으로 첫 번째 행을 반환한다", () => {
    const result = toObj(mockResult);
    expect(result).toEqual({ id: 1, ticker: "005930", close_price: 75000 });
  });

  it("idx=1로 두 번째 행을 반환한다", () => {
    const result = toObj(mockResult, 1);
    expect(result).toEqual({ id: 2, ticker: "AAPL", close_price: 180.5 });
  });

  it("null 값이 있어도 올바르게 처리한다", () => {
    const res = {
      columns: ["id", "thesis"],
      rows: [[42, null]],
    };
    const result = toObj(res);
    expect(result.id).toBe(42);
    expect(result.thesis).toBeNull();
  });
});
