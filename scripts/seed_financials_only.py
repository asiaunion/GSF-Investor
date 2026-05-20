#!/usr/bin/env python3
"""
seed_financials_only.py — DART 재무 데이터 수집 전용 스크립트
========================================================
동서(026960, corp_code=00144395) 및 미코(059090, corp_code=00366942)
최근 8분기 재무제표를 DART OpenAPI로 수집하여 financials 테이블에 시딩.

실행: python3 scripts/seed_financials_only.py

실데이터 안전 장치:
  REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE — 원격 DB 쓰기 전 필수.
  (DRY_RUN 미지원 — 대량 INSERT가 포함됩니다.)
"""

import os, sys, time, datetime, requests
from typing import Optional

# ── .env 로드 ──────────────────────────────────────────────────────────────────
def load_dotenv(path: str) -> None:
    if not os.path.exists(path): return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, _, v = line.partition("=")
            k = k.strip(); v = v.strip().strip('"').strip("'")
            if k not in os.environ: os.environ[k] = v

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from real_data_guard import enforce_remote_write_guard, is_dry_run

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")
DART_KEY    = os.environ.get("DART_API_KEY", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 없음")
    sys.exit(1)
if not DART_KEY:
    print("[ERROR] DART_API_KEY 없음")
    sys.exit(1)

http_url = TURSO_URL.replace("libsql://", "https://")

# ── Turso 헬퍼 ────────────────────────────────────────────────────────────────
def turso_exec(statements: list) -> list:
    payload = {"requests": [
        {"type": "execute", "stmt": {"sql": s["q"], "args": [
            {"type": "text",    "value": str(p)}        if isinstance(p, str)
            else {"type": "integer", "value": str(int(p))} if isinstance(p, int) and not isinstance(p, bool)
            else {"type": "float",   "value": float(p)}    if isinstance(p, float)
            else {"type": "null"}
            for p in s.get("params", [])
        ]}}
        for s in statements
    ] + [{"type": "close"}]}
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json=payload, timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("results", [])

def turso_one(sql: str, params: list = None) -> list:
    results = turso_exec([{"q": sql, "params": params or []}])
    if not results: return []
    res = results[0]
    if res.get("type") == "error":
        raise RuntimeError(f"SQL Error: {res}")
    rs = res.get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    return [{cols[i]: (v.get("value") if v.get("type") != "null" else None)
             for i, v in enumerate(row)} for row in rs.get("rows", [])]

# ── DART API ──────────────────────────────────────────────────────────────────
def fetch_dart_financials(corp_code: str, year: int, report_code: str, fs_div: str = "CFS") -> Optional[dict]:
    url = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"
    params = {
        "crtfc_key": DART_KEY,
        "corp_code": corp_code,
        "bsns_year": str(year),
        "reprt_code": report_code,
        "fs_div": fs_div,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        data = resp.json()
        if data.get("status") != "000":
            return None
        return data
    except Exception as e:
        print(f"    [WARN] DART API 오류: {e}")
        return None

def parse_dart_amount(val_str: Optional[str]) -> Optional[float]:
    if not val_str or val_str.strip() == "": return None
    try:
        return float(val_str.replace(",", "").strip())  # DART API = 이미 원(KRW) 단위
    except ValueError:
        return None

# ── 수집 대상 종목 ────────────────────────────────────────────────────────────
TARGETS = [
    {"ticker": "026960", "name": "동서",  "dart_corp_code": "00144395"},
    {"ticker": "059090", "name": "미코",  "dart_corp_code": "00366942"},
]

# ── 수집 범위 결정 ────────────────────────────────────────────────────────────
# 연간(FY): 최근 5개년
# 분기(Q):  최근 4분기 (현재 연도에서 발표된 분기만)
ANNUAL_YEARS = 5   # FY 수집 연도 수

def build_periods() -> list:
    """
    반환: [(year, period_label, reprt_code), ...]
    - FY: 최근 5개년 전체 (예: 2021FY ~ 2025FY)
    - Q:  올해 발표된 최근 분기 (예: 2026Q1 등)
    순서: 오래된 것 → 최근 (INSERT OR REPLACE 이므로 중복 무관)
    """
    today = datetime.date.today()
    periods = []

    # ── 연간(FY): (today.year - 1) 기준 직전 5개년 ──────────────────────────
    # 당해연도 FY는 사업보고서 제출 전(보통 3월)엔 없으므로 전년도까지만
    last_fy_year = today.year - 1
    for y in range(last_fy_year - ANNUAL_YEARS + 1, last_fy_year + 1):
        periods.append((y, f"{y}FY", "11011"))

    # ── 분기(Q): 올해 발표된 분기 ────────────────────────────────────────────
    cur = today.year
    if today.month >= 11:
        periods += [
            (cur, f"{cur}Q3", "11014"),
            (cur, f"{cur}Q2", "11012"),
            (cur, f"{cur}Q1", "11013"),
        ]
    elif today.month >= 8:
        periods += [
            (cur, f"{cur}Q2", "11012"),
            (cur, f"{cur}Q1", "11013"),
        ]
    elif today.month >= 5:
        periods += [(cur, f"{cur}Q1", "11013")]

    return periods

# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="seed_financials_only.py")
    if is_dry_run():
        print("[ERROR] seed_financials_only.py 는 DRY_RUN을 지원하지 않습니다.")
        sys.exit(2)
    print("=" * 60)
    print("  GSF-Investor — DART 재무 데이터 수집 (financials)")
    print(f"  Turso: {http_url}")
    print("=" * 60)

    # 연결 테스트
    rows = turso_one("SELECT sqlite_version() AS v")
    print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")

    quarters = build_periods()
    print(f"수집 대상: {[q[1] for q in quarters]}\n")

    # ticker → stock_id 매핑
    ticker_to_id = {}
    for t in TARGETS:
        rows = turso_one("SELECT id FROM stocks WHERE ticker=?", [t["ticker"]])
        if rows:
            ticker_to_id[t["ticker"]] = int(rows[0]["id"])
        else:
            print(f"  [WARN] {t['ticker']} stocks 테이블에 없음 — SKIP")

    total_inserted = 0
    total_skipped  = 0
    total_nodata   = 0

    for t in TARGETS:
        stock_id = ticker_to_id.get(t["ticker"])
        if not stock_id:
            continue
            
        print(f"\n📊 {t['ticker']} ({t['name']}) corp_code={t['dart_corp_code']}")
        
        # Yahoo Finance에서 shares_outstanding 가져오기 (BPS 계산용)
        shares_out = None
        try:
            import yfinance as yf
            # TARGETS에 yahoo_ticker가 없으므로 임시로 코스닥/코스피 판별
            suffix = ".KS" if t["ticker"] == "026960" else ".KQ"
            yf_ticker = yf.Ticker(t["ticker"] + suffix)
            shares_out = yf_ticker.info.get("sharesOutstanding")
        except Exception as e:
            print(f"    [WARN] yfinance sharesOutstanding 조회 실패: {e}")

        for year, period_label, report_code in quarters:
            # 이미 존재 확인
            # existing = turso_one(
            #     "SELECT id FROM financials WHERE stock_id=? AND period=? AND source='DART'",
            #     [stock_id, period_label]
            # )
            # if existing:
            #     print(f"  ⏭️  {period_label}: 이미 존재 (id={existing[0]['id']}) — SKIP")
            #     total_skipped += 1
            #     continue

            print(f"  📥 {period_label} ({report_code}) 조회 중...", end=" ", flush=True)
            # 1순위: 연결(CFS), 2순위: 별도(OFS)
            data = fetch_dart_financials(t["dart_corp_code"], year, report_code, "CFS")
            if not data:
                data = fetch_dart_financials(t["dart_corp_code"], year, report_code, "OFS")
            
            if not data:
                print("데이터 없음")
                total_nodata += 1
                continue

            # 계정과목 파싱
            # BS/IS/CIS 우선 → CF(현금흐름표) → 나머지 순서로 적용
            # SCE(자본변동표) 등에 중복 '자본총계' 항목이 있어 덮어쓰기 방지
            accounts = data.get("list", [])
            acc_map: dict = {}
            cf_map:  dict = {}  # 현금흐름표 전용 맵 (CF 구분)

            # 1패스: BS + IS 항목만 먼저 저장
            for acc in accounts:
                sj_div = acc.get("sj_div", "")
                label  = acc.get("account_nm", "").strip()
                val    = acc.get("thstrm_amount", "") or acc.get("thstrm_add_amount", "")
                if sj_div == "CF":
                    # 현금흐름표 항목은 별도 맵에 저장 (최초 등장만)
                    if label and label not in cf_map:
                        cf_map[label] = val
                elif sj_div in ("BS", "IS", "CIS"):
                    if label and label not in acc_map:
                        acc_map[label] = val
            # 2패스: 나머지 항목 보완 (아직 없는 항목만)
            for acc in accounts:
                label = acc.get("account_nm", "").strip()
                val   = acc.get("thstrm_amount", "") or acc.get("thstrm_add_amount", "")
                if label and label not in acc_map and label not in cf_map:
                    acc_map[label] = val

            def get_amount(labels):
                for lbl in labels:
                    if lbl in acc_map:
                        return parse_dart_amount(acc_map[lbl])
                return None

            revenue      = get_amount(["매출액", "영업수익", "수익(매출액)"])
            op_income    = get_amount(["영업이익", "영업이익(손실)"])
            net_income   = get_amount(["당기순이익", "당기순이익(손실)"])
            total_assets = get_amount(["자산총계"])
            total_equity = get_amount(["자본총계"])
            cash_eq      = get_amount(["현금및현금성자산"])
            div_per_sh   = get_amount(["주당배당금"])

            # 영업현금흐름: 현금흐름표(CF)에서 파싱
            def get_cf_amount(labels):
                for lbl in labels:
                    if lbl in cf_map:
                        return parse_dart_amount(cf_map[lbl])
                return None

            oper_cash_flow = get_cf_amount([
                "영업활동으로인한현금흐름",
                "영업활동현금흐름",
                "영업활동으로 인한 현금흐름",
                "영업활동현금흐름(간접법)",
            ])

            debt_ratio = None
            if total_equity and total_assets and total_equity != 0:
                total_liab = total_assets - total_equity
                debt_ratio = round(total_liab / total_equity * 100, 2)

            # EPS (우선순위 순으로 탐색 후, 사용자 요청에 따라 전체 순이익 / 주식수로 오버라이드)
            eps = get_amount([
                "기본주당이익", "희석주당이익", "기본주당순이익",
                "기본주당이익(손실)", "희석주당이익(손실)",
                "기본주당계속영업이익(손실)", "계속영업기본주당순이익",
                "기본주당계속영업손익",
            ])
            
            if net_income and shares_out:
                eps = round(net_income / shares_out, 2)

            bps = get_amount(["주당순자산가치", "주당순자산", "주당순자산(BPS)"])

            if not bps and total_equity and shares_out:
                bps = round(total_equity / shares_out, 2)

            turso_one(
                """INSERT OR REPLACE INTO financials
                    (stock_id, period, revenue, op_income, net_income,
                     total_assets, total_equity, cash_and_equivalents,
                     debt_ratio, dividend_per_share, eps, bps, shares_outstanding,
                     free_cash_flow, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                [stock_id, period_label, revenue, op_income, net_income,
                 total_assets, total_equity, cash_eq, debt_ratio, div_per_sh,
                 eps, bps, shares_out, oper_cash_flow, "DART"]
            )
            rev_b = f"{revenue/1e8:.0f}억" if revenue else "?"
            op_b  = f"{op_income/1e8:.0f}억" if op_income else "?"
            dr    = f"{debt_ratio:.1f}%" if debt_ratio is not None else "?"
            ocf_b = f"{oper_cash_flow/1e8:.0f}억" if oper_cash_flow else "?"
            print(f"✅  매출={rev_b} 영익={op_b} 부채비율={dr} eps={eps} bps={bps} 영업CF={ocf_b}")
            total_inserted += 1
            time.sleep(0.4)

    print(f"\n{'='*60}")
    print(f"  완료 — 삽입:{total_inserted} 스킵:{total_skipped} 데이터없음:{total_nodata}")
    print(f"{'='*60}\n")

    # 최종 검증
    print("=== financials 현황 ===")
    for t in TARGETS:
        stock_id = ticker_to_id.get(t["ticker"])
        if not stock_id: continue
        rows = turso_one(
            "SELECT period, revenue, op_income, debt_ratio FROM financials WHERE stock_id=? ORDER BY period DESC",
            [stock_id]
        )
        print(f"\n{t['ticker']} ({t['name']}) — {len(rows)}행")
        for r in rows:
            rev = f"{float(r['revenue'])/1e8:.0f}억" if r.get('revenue') else "?"
            op  = f"{float(r['op_income'])/1e8:.0f}억" if r.get('op_income') else "?"
            dr  = f"{r['debt_ratio']}%" if r.get('debt_ratio') else "?"
            print(f"  {r['period']:10s}  매출={rev:8s}  영익={op:8s}  부채비율={dr}")

    # ── 3패스: Q4 (4분기) 데이터 합성 (FY - Q3) ──────────────────────────────────
    print("\n[INFO] Q4 데이터 합성 중 (FY - Q3)...")
    today = datetime.date.today()
    for t in TARGETS:
        stock_id = ticker_to_id.get(t["ticker"])
        if not stock_id: continue
        # 당해연도가 아니라 작년(최신 FY)에 대해 Q4를 계산
        last_fy = today.year - 1
        fy_period = f"{last_fy}FY"
        q3_period = f"{last_fy}Q3"
        q4_period = f"{last_fy}Q4"
        
        fy_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, fy_period])
        q3_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, q3_period])
        q2_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, f"{last_fy}Q2"])
        q1_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, f"{last_fy}Q1"])
        
        if fy_row and q3_row and q2_row and q1_row:
            fy = fy_row[0]
            q3 = q3_row[0]
            q2 = q2_row[0]
            q1 = q1_row[0]
            def safe_sub(f_val, q3_val, q2_val, q1_val):
                if f_val is not None and q3_val is not None and q2_val is not None and q1_val is not None:
                    return float(f_val) - float(q3_val) - float(q2_val) - float(q1_val)
                return None
            
            turso_run("DELETE FROM financials WHERE stock_id=? AND period=?", [stock_id, q4_period])
            
            turso_run("""
                INSERT INTO financials (
                    stock_id, period, revenue, op_income, net_income, total_assets, total_equity,
                    cash_and_equivalents, debt_ratio, shares_outstanding, eps, bps, roe,
                    dividend_per_share, free_cash_flow, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                stock_id, q4_period,
                safe_sub(fy['revenue'], q3['revenue'], q2['revenue'], q1['revenue']),
                safe_sub(fy['op_income'], q3['op_income'], q2['op_income'], q1['op_income']),
                safe_sub(fy['net_income'], q3['net_income'], q2['net_income'], q1['net_income']),
                fy['total_assets'], fy['total_equity'], fy['cash_and_equivalents'],
                fy['debt_ratio'], fy['shares_outstanding'], safe_sub(fy['eps'], q3['eps'], q2['eps'], q1['eps']),
                fy['bps'], None, fy['dividend_per_share'], safe_sub(fy['free_cash_flow'], q3['free_cash_flow'], q2['free_cash_flow'], q1['free_cash_flow']),
                'Calculated'
            ])
            print(f"  ✅ {t['ticker']} {q4_period} 합성 완료")

if __name__ == "__main__":
    main()

