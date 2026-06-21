/**
 * libSQL ResultSet → 컬럼명 기반 객체 변환 헬퍼
 *
 * db.run(sql`...`) 결과는 { columns: string[], rows: InValue[][] } 구조를 가진다.
 * 위치 인덱스(row[0], row[1]) 대신 컬럼명으로 접근해 스키마 변경 시 silent bug를 방지한다.
 */

// libSQL ResultSet의 구조적 부분만 요구 (테스트 목업과 호환)
export interface RawResult {
  columns: string[];
  rows: unknown[][];
}

type Row = Record<string, unknown>;

export function toObjs(res: RawResult): Row[] {
  return res.rows.map((row) =>
    Object.fromEntries(res.columns.map((col, i) => [col, row[i]]))
  );
}

export function toObj(res: RawResult, idx = 0): Row {
  return Object.fromEntries(res.columns.map((col, i) => [col, res.rows[idx][i]]));
}
