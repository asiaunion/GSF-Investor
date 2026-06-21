#!/usr/bin/env python3
"""
auto_financials.py — DART 재무 데이터 자동 수집 (전종목)
=========================================================
DB의 모든 활성 한국 종목(is_active=1, dart_corp_code IS NOT NULL)을 대상으로
DART OpenAPI fnlttSinglAcntAll 를 호출해 financials 테이블을 자동 갱신.

seed_financials_only.py 의 하드코딩된 TARGETS를 DB 동적 조회로 교체.

수집 범위:
  - FY: 직전 5개년 (전년도 기준)
  - Q:  이미 발표됐을 당해연도 분기 (월 기준 자동 판별)
  - Q4: FY - Q1 - Q2 - Q3 합성 (연산)

환경변수 (GitHub Secrets):
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io
  TURSO_AUTH_TOKEN    예) eyJ...
  DART_API_KEY        DART OpenAPI 인증키
  TELEGRAM_BOT_TOKEN  선택 — 완료/실패 알림
  TELEGRAM_CHAT_ID    선택

실데이터 안전 장치:
  REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE — 원격 DB 쓰기 전 필수.
  DRY_RUN=1 — DB 쓰기 생략, DART 조회는 수행.

실행:
  python3 scripts/auto_financials.py                      # 전종목
  python3 scripts/auto_financials.py --ticker 005930      # 단일 종목
  DRY_RUN=1 python3 scripts/auto_financials.py            # 드라이런
"""

import os
import sys
import time
import datetime
import argparse
import requests
from typing import Optional

# ── .env 로드 ──────────────────────────────────────────────────────────────────
def load_dotenv(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip(); v = v.strip().strip('"').strip("'")
            if k not in os.environ:
                os.environ[k] = v

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, "..", ".env.local"))
load_dotenv(os.path.join(_script_dir, "..", ".env"))

from real_data_guard import enforce_remote_write_guard, is_dry_run

TURSO_URL          = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN        = os.environ.get("TURSO_AUTH_TOKEN", "")
DART_KEY           = os.environ.get("DART_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 없음")
    sys.exit(1)
if not DART_KEY:
    print("[ERROR] DART_API_KEY 없음")
    sys.exit(1)

http_url = TURSO_URL.replace("libsql://", "https://")

ANNUAL_YEARS = 5  # FY 수집 연도 수

# ── Turso 헬퍼 ────────────────────────────────────────────────────────────────
def _encode_param(p):
    if p is None:
        return {"type": "null"}
    if isinstance(p, bool):
        return {"type": "integer", "value": str(int(p))}
    if isinstance(p, int):
        return {"type": "integer", "value": str(p)}
    if isinstance(p, float):
        return {"type": "float", "value": p}
    return {"type": "text", "value": str(p)}

def turso_exec(statements: list) -> list:
    payload = {"requests": [
        {"type": "execute", "stmt": {"sql": s["q"], "args": [_encode_param(p) for p in s.get("params", [])]}}
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
    if not results:
        return []
    res = results[0]
    if res.get("type") == "error":
        raise RuntimeError(f"SQL Error: {res}")
    rs = res.get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    return [
        {cols[i]: (v.get("value") if v.get("type") != "null" else None) for i, v in enumerate(row)}
        for row in rs.get("rows", [])
    ]

# ── Telegram ──────────────────────────────────────────────────────────────────
def notify_telegram(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        resp = requests.post(
            url, json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}, timeout=5
        )
        if resp.status_code != 200:
            print(f"    [WARN] Telegram 발송 실패: {resp.status_code}")
    except Exception as e:
        print(f"    [WARN] Telegram 알림 실패: {e}")

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
    if not val_str or val_str.strip() == "":
        return None
    try:
        return float(val_str.replace(",", "").replace(" ", ""))
    except ValueError:
        return None

# ── 수집 범위 결정 ────────────────────────────────────────────────────────────
def build_periods() -> list:
    """
    반환: [(year, period_label, reprt_code), ...]
    - FY: 최근 5개년 (전년도 기준)
    - Q:  당해연도 발표된 분기 (월 기준 자동 판별)
    """
    today = datetime.date.today()
    periods = []

    last_fy_year = today.year - 1
    for y in range(last_fy_year - ANNUAL_YEARS + 1, last_fy_year + 1):
        periods.append((y, f"{y}FY", "11011"))

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

# ── 단일 종목 재무 수집 ────────────────────────────────────────────────────────
def process_stock(stock: dict, periods: list, dry_run: bool) -> dict:
    """단일 종목의 모든 periods를 DART에서 수집해 DB에 적재."""
    stock_id   = stock["id"]
    ticker     = stock["ticker"]
    name       = stock["name"]
    corp_code  = stock["dart_corp_code"]
    shares_out = stock.get("shares_outstanding")

    # DB에 shares_outstanding이 없으면 financials 테이블에서 최신값 조회
    if not shares_out:
        rows = turso_one(
            "SELECT shares_outstanding FROM financials WHERE stock_id=? AND shares_outstanding IS NOT NULL ORDER BY period DESC LIMIT 1",
            [stock_id]
        )
        if rows:
            shares_out = rows[0].get("shares_outstanding")
            if shares_out:
                shares_out = float(shares_out)

    stats = {"inserted": 0, "skipped": 0, "nodata": 0}

    for year, period_label, report_code in periods:
        # 이미 존재하는 경우 스킵 (FY는 항상 갱신, Q는 스킵)
        is_annual = period_label.endswith("FY")
        if not is_annual:
            existing = turso_one(
                "SELECT id FROM financials WHERE stock_id=? AND period=? AND source='DART'",
                [stock_id, period_label]
            )
            if existing:
                print(f"    ⏭️  {period_label}: 이미 존재 — SKIP")
                stats["skipped"] += 1
                continue

        print(f"    📥 {period_label} ({report_code}) 조회 중...", end=" ", flush=True)

        # 1순위: 연결(CFS), 2순위: 별도(OFS)
        data = fetch_dart_financials(corp_code, year, report_code, "CFS")
        if not data:
            data = fetch_dart_financials(corp_code, year, report_code, "OFS")

        if not data:
            print("데이터 없음")
            stats["nodata"] += 1
            time.sleep(0.4)
            continue

        accounts = data.get("list", [])
        acc_map: dict = {}
        cf_map:  dict = {}

        for acc in accounts:
            sj_div = acc.get("sj_div", "")
            label  = acc.get("account_nm", "").strip()
            val    = acc.get("thstrm_amount", "") or acc.get("thstrm_add_amount", "")
            if sj_div == "CF":
                if label and label not in cf_map:
                    cf_map[label] = val
            elif sj_div in ("BS", "IS", "CIS"):
                if label and label not in acc_map:
                    acc_map[label] = val

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

        def get_cf_amount(labels):
            for lbl in labels:
                if lbl in cf_map:
                    return parse_dart_amount(cf_map[lbl])
            return None

        revenue      = get_amount(["매출액", "영업수익", "수익(매출액)"])
        op_income    = get_amount(["영업이익", "영업이익(손실)"])
        net_income   = get_amount(["당기순이익", "당기순이익(손실)"])
        total_assets = get_amount(["자산총계"])
        total_equity = get_amount(["자본총계"])
        cash_eq      = get_amount(["현금및현금성자산"])
        div_per_sh   = get_amount(["주당배당금"])

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

        eps = get_amount([
            "기본주당이익", "희석주당이익", "기본주당순이익",
            "기본주당이익(손실)", "희석주당이익(손실)",
            "기본주당계속영업이익(손실)", "계속영업기본주당순이익",
        ])
        if net_income and shares_out:
            eps = round(net_income / shares_out, 2)

        bps = get_amount(["주당순자산가치", "주당순자산", "주당순자산(BPS)"])
        if not bps and total_equity and shares_out:
            bps = round(total_equity / shares_out, 2)

        roe = None
        if net_income and total_equity and total_equity > 0:
            roe = round(net_income / total_equity * 100, 2)

        rev_b = f"{revenue/1e8:.0f}억" if revenue else "?"
        op_b  = f"{op_income/1e8:.0f}억" if op_income else "?"
        dr    = f"{debt_ratio:.1f}%" if debt_ratio is not None else "?"
        print(f"✅  매출={rev_b} 영익={op_b} 부채비율={dr} eps={eps} bps={bps}")

        if not dry_run:
            turso_one(
                """INSERT OR REPLACE INTO financials
                    (stock_id, period, revenue, op_income, net_income,
                     total_assets, total_equity, cash_and_equivalents,
                     debt_ratio, dividend_per_share, eps, bps, roe, shares_outstanding,
                     free_cash_flow, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                [stock_id, period_label, revenue, op_income, net_income,
                 total_assets, total_equity, cash_eq, debt_ratio, div_per_sh,
                 eps, bps, roe, shares_out, oper_cash_flow, "DART"]
            )
        stats["inserted"] += 1
        time.sleep(0.4)  # DART API rate limit

    return stats

# ── Q4 합성 ───────────────────────────────────────────────────────────────────
def synthesize_q4(stock_id: int, ticker: str, dry_run: bool) -> bool:
    """Q4 = FY - Q1 - Q2 - Q3 합성. 이미 존재하면 스킵."""
    today = datetime.date.today()
    last_fy = today.year - 1
    fy_period = f"{last_fy}FY"
    q4_period = f"{last_fy}Q4"

    # Q4가 이미 있으면 스킵
    existing = turso_one(
        "SELECT id FROM financials WHERE stock_id=? AND period=?", [stock_id, q4_period]
    )
    if existing:
        return False

    fy_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, fy_period])
    q3_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, f"{last_fy}Q3"])
    q2_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, f"{last_fy}Q2"])
    q1_row = turso_one("SELECT * FROM financials WHERE stock_id=? AND period=?", [stock_id, f"{last_fy}Q1"])

    if not (fy_row and q3_row and q2_row and q1_row):
        return False

    fy, q3, q2, q1 = fy_row[0], q3_row[0], q2_row[0], q1_row[0]

    def safe_sub(f_val, *q_vals):
        if f_val is None or any(v is None for v in q_vals):
            return None
        return float(f_val) - sum(float(v) for v in q_vals)

    print(f"    🔢 {q4_period} Q4 합성 중...")
    if not dry_run:
        turso_one(
            """INSERT OR REPLACE INTO financials (
                stock_id, period, revenue, op_income, net_income, total_assets, total_equity,
                cash_and_equivalents, debt_ratio, shares_outstanding, eps, bps, roe,
                dividend_per_share, free_cash_flow, source
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [
                stock_id, q4_period,
                safe_sub(fy["revenue"], q3["revenue"], q2["revenue"], q1["revenue"]),
                safe_sub(fy["op_income"], q3["op_income"], q2["op_income"], q1["op_income"]),
                safe_sub(fy["net_income"], q3["net_income"], q2["net_income"], q1["net_income"]),
                fy["total_assets"], fy["total_equity"], fy["cash_and_equivalents"],
                fy["debt_ratio"], fy["shares_outstanding"],
                safe_sub(fy["eps"], q3["eps"], q2["eps"], q1["eps"]),
                fy["bps"], None, fy["dividend_per_share"],
                safe_sub(fy["free_cash_flow"], q3["free_cash_flow"], q2["free_cash_flow"], q1["free_cash_flow"]),
                "Calculated",
            ],
        )
    return True

# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="DART 재무 자동 수집 (전종목)")
    parser.add_argument("--ticker", help="특정 종목만 처리 (예: 005930)")
    args = parser.parse_args()

    enforce_remote_write_guard(database_url=TURSO_URL, script_name="auto_financials.py")
    dry_run = is_dry_run()

    print("=" * 60)
    print("  GSF-Investor — DART 재무 자동 수집 (auto_financials.py)")
    print(f"  Turso: {http_url}")
    print(f"  DRY_RUN: {'ON' if dry_run else 'OFF'}")
    print("=" * 60)

    # DB 연결 확인
    rows = turso_one("SELECT sqlite_version() AS v")
    print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")

    # 대상 종목 조회 (dart_corp_code 있는 KR 종목)
    if args.ticker:
        stocks = turso_one(
            "SELECT id, ticker, name, dart_corp_code, shares_outstanding FROM stocks WHERE ticker=? AND is_active=1 AND dart_corp_code IS NOT NULL",
            [args.ticker]
        )
        if not stocks:
            print(f"[ERROR] ticker={args.ticker} 종목을 찾을 수 없거나 dart_corp_code가 없습니다.")
            sys.exit(1)
    else:
        stocks = turso_one(
            "SELECT id, ticker, name, dart_corp_code, shares_outstanding FROM stocks WHERE is_active=1 AND dart_corp_code IS NOT NULL ORDER BY ticker"
        )

    periods = build_periods()
    print(f"📋 대상 종목: {len(stocks)}개  |  수집 기간: {len(periods)}개")
    print(f"   기간 목록: {[p[1] for p in periods]}\n")

    total_inserted = 0
    total_skipped  = 0
    total_nodata   = 0
    failed_stocks  = []

    for stock in stocks:
        ticker = stock["ticker"]
        name   = stock["name"]
        print(f"\n{'─'*50}")
        print(f"  📊 {ticker} ({name})")
        print(f"{'─'*50}")

        try:
            stats = process_stock(stock, periods, dry_run)
            total_inserted += stats["inserted"]
            total_skipped  += stats["skipped"]
            total_nodata   += stats["nodata"]

            # Q4 합성
            synth = synthesize_q4(int(stock["id"]), ticker, dry_run)
            if synth:
                print(f"    ✅ Q4 합성 완료")
        except Exception as e:
            print(f"    [ERROR] {ticker}: {e}")
            failed_stocks.append(ticker)

    print(f"\n{'='*60}")
    print(f"  완료 — 삽입:{total_inserted}  스킵:{total_skipped}  데이터없음:{total_nodata}  실패:{len(failed_stocks)}")
    if dry_run:
        print("  ※ DRY_RUN=1 — DB 쓰기는 수행하지 않았습니다.")
    if failed_stocks:
        print(f"  실패 종목: {', '.join(failed_stocks)}")
    print(f"{'='*60}\n")

    # Telegram 완료 알림
    status_emoji = "✅" if not failed_stocks else "⚠️"
    msg = (
        f"{status_emoji} <b>재무 자동수집 완료</b>\n"
        f"종목: {len(stocks)}개  삽입: {total_inserted}  스킵: {total_skipped}\n"
        f"데이터없음: {total_nodata}  실패: {len(failed_stocks)}"
    )
    if failed_stocks:
        msg += f"\n실패: {', '.join(failed_stocks)}"
    if dry_run:
        msg += "\n<i>※ DRY_RUN 모드</i>"
    notify_telegram(msg)

    if failed_stocks:
        sys.exit(1)

if __name__ == "__main__":
    main()
