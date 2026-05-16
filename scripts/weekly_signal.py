#!/usr/bin/env python3
"""
GSF-Investor Phase 3 — weekly_signal.py
========================================
매주 일요일 KST 21:00 (UTC 12:00) GitHub Actions 크론으로 실행.

집계 분석 전용 (LOW/MEDIUM 시그널):
  1. 주가 추세 — 주간 변동률 ±5% 초과 → LOW
  2. 주가 추세 — 월간 변동률 ±15% 초과 → MEDIUM
  3. 재무 변화 — 부채비율 전기 대비 20%p 급등 → MEDIUM
  4. 재무 변화 — 영업이익 적자 전환 → MEDIUM
  5. 배당 변동 — 전기 대비 배당 증감 10%+ → MEDIUM

HIGH 시그널은 daily_dart.py에서 즉시 감지. 이 스크립트는 집계 분석만.

환경변수 (GitHub Secrets):
  TURSO_DATABASE_URL  예) libsql://xxx.turso.io
  TURSO_AUTH_TOKEN    예) eyJ...

실행:
  python3 scripts/weekly_signal.py
"""

import os
import sys
import datetime
import requests

# ──────────────────────────────────────────────────────────────────────────────
# 0. .env.local 로드 (로컬 개발 시)
# ──────────────────────────────────────────────────────────────────────────────

def load_dotenv(path: str) -> None:
    """간단한 .env 파서 (python-dotenv 미사용)"""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key not in os.environ:
                os.environ[key] = val

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, "..", ".env.local"))
load_dotenv(os.path.join(_script_dir, "..", ".env"))

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 없습니다.")
    sys.exit(1)

# libsql:// → https://
http_url = TURSO_URL.replace("libsql://", "https://")


def notify_telegram(message: str) -> None:
    """Telegram Bot API로 메시지 발송. 토큰/채팅ID 없으면 조용히 스킵."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}
    try:
        resp = requests.post(url, json=payload, timeout=5)
        if resp.status_code != 200:
            print(f"    [WARN] Telegram 발송 실패: {resp.status_code} {resp.text[:100]}")
    except Exception as e:
        print(f"    [WARN] Telegram 알림 실패: {e}")

# ──────────────────────────────────────────────────────────────────────────────
# 1. Turso HTTP 헬퍼 (daily_price.py와 동일 패턴)
# ──────────────────────────────────────────────────────────────────────────────

def _encode_param(p):
    """Python 값 → Turso typed arg"""
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
    """Turso HTTP API 배치 실행"""
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": s["q"],
                    "args": [_encode_param(p) for p in s.get("params", [])],
                },
            }
            for s in statements
        ] + [{"type": "close"}]
    }
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {TURSO_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:400]}")
    return resp.json().get("results", [])


def turso_one(sql: str, params: list = None) -> list:
    """단일 쿼리 → rows 리스트 반환"""
    results = turso_exec([{"q": sql, "params": params or []}])
    if not results:
        return []
    res = results[0]
    if res.get("type") == "error":
        raise RuntimeError(f"SQL Error: {res}")
    rs = res.get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    rows = []
    for row in rs.get("rows", []):
        rows.append(
            {cols[i]: (v.get("value") if v.get("type") != "null" else None)
             for i, v in enumerate(row)}
        )
    return rows


def turso_batch(statements: list) -> int:
    """여러 INSERT를 200개씩 나눠 실행 → 삽입 성공 건수 반환"""
    if not statements:
        return 0
    inserted = 0
    chunk_size = 200
    for i in range(0, len(statements), chunk_size):
        chunk = statements[i : i + chunk_size]
        results = turso_exec(chunk)
        for r in results:
            if r.get("type") == "error":
                print(f"  [WARN] 배치 오류: {r}")
            else:
                resp = r.get("response", {}).get("result", {})
                inserted += resp.get("affected_row_count", 0)
    return inserted


# ──────────────────────────────────────────────────────────────────────────────
# 2. 활성 종목 조회
# ──────────────────────────────────────────────────────────────────────────────

def fetch_active_stocks() -> list:
    """Turso에서 is_active=1 종목 모두 반환."""
    rows = turso_one(
        """SELECT id AS stock_id, ticker, name, market
           FROM stocks
           WHERE is_active = 1"""
    )
    return [
        {
            "stock_id": int(r["stock_id"]),
            "ticker": r["ticker"],
            "name": r["name"],
            "market": r["market"],
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────────────────────
# 3. 주가 추세 분석 (LOW/MEDIUM)
# ──────────────────────────────────────────────────────────────────────────────

def analyze_price_trend(stock: dict) -> list:
    """
    최근 가격 데이터로 주간·월간 변동률 분석.
    반환: [{"type": "PRICE_SURGE", "severity": "LOW", "description": "..."}, ...]
    """
    stock_id = stock["stock_id"]
    today = datetime.date.today()
    week_ago = (today - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (today - datetime.timedelta(days=30)).strftime("%Y-%m-%d")

    # 최근 35일 가격 조회 (주간/월간 비교용)
    rows = turso_one(
        """SELECT date, close_price FROM prices
           WHERE stock_id = ? AND date >= ?
           ORDER BY date DESC
           LIMIT 40""",
        [stock_id, month_ago],
    )

    if len(rows) < 2:
        return []

    signals = []

    # 가장 최근 가격
    latest_price = float(rows[0]["close_price"] or 0)
    latest_date = rows[0]["date"]

    if latest_price <= 0:
        return []

    # 주간 비교: 7일 전과 가장 가까운 데이터
    week_rows = [r for r in rows if r["date"] <= week_ago]
    if week_rows:
        week_old_price = float(week_rows[0]["close_price"] or 0)
        if week_old_price > 0:
            week_change_pct = (latest_price - week_old_price) / week_old_price * 100
            if abs(week_change_pct) >= 5:
                direction = "급등" if week_change_pct > 0 else "급락"
                signals.append({
                    "type": "PRICE_SURGE",
                    "severity": "LOW",
                    "description": (
                        f"주간 주가 {direction} {week_change_pct:+.1f}% "
                        f"({week_rows[0]['date']} {week_old_price:,.0f} → {latest_date} {latest_price:,.0f})"
                    ),
                })

    # 월간 비교: 30일 전과 가장 가까운 데이터
    month_rows = [r for r in rows if r["date"] <= month_ago]
    if month_rows:
        month_old_price = float(month_rows[0]["close_price"] or 0)
        if month_old_price > 0:
            month_change_pct = (latest_price - month_old_price) / month_old_price * 100
            if abs(month_change_pct) >= 15:
                direction = "급등" if month_change_pct > 0 else "급락"
                signals.append({
                    "type": "PRICE_SURGE",
                    "severity": "MEDIUM",
                    "description": (
                        f"월간 주가 {direction} {month_change_pct:+.1f}% "
                        f"({month_rows[0]['date']} {month_old_price:,.0f} → {latest_date} {latest_price:,.0f})"
                    ),
                })

    return signals


# ──────────────────────────────────────────────────────────────────────────────
# 4. 재무 변화 분석 (MEDIUM)
# ──────────────────────────────────────────────────────────────────────────────

def analyze_financials(stock: dict) -> list:
    """
    최근 2개 재무 분기 비교 → 부채비율 급등, 영업이익 적자 전환 감지.
    반환: [{"type": "DEBT_SURGE" | "OP_LOSS", "severity": "MEDIUM", "description": "..."}, ...]
    """
    stock_id = stock["stock_id"]

    rows = turso_one(
        """SELECT period, debt_ratio, op_income, dividend_per_share
           FROM financials
           WHERE stock_id = ?
           ORDER BY period DESC
           LIMIT 3""",
        [stock_id],
    )

    if len(rows) < 2:
        return []

    signals = []
    curr = rows[0]
    prev = rows[1]

    # 부채비율 급등 (20%p 이상)
    curr_debt = curr.get("debt_ratio")
    prev_debt = prev.get("debt_ratio")
    if curr_debt is not None and prev_debt is not None:
        curr_debt = float(curr_debt)
        prev_debt = float(prev_debt)
        if prev_debt > 0 and (curr_debt - prev_debt) >= 20:
            signals.append({
                "type": "DEBT_SURGE",
                "severity": "MEDIUM",
                "description": (
                    f"부채비율 급등 {prev['period']} {prev_debt:.1f}% → "
                    f"{curr['period']} {curr_debt:.1f}% "
                    f"(+{curr_debt - prev_debt:.1f}%p)"
                ),
            })

    # 영업이익 적자 전환
    curr_op = curr.get("op_income")
    prev_op = prev.get("op_income")
    if curr_op is not None and prev_op is not None:
        curr_op = float(curr_op)
        prev_op = float(prev_op)
        if prev_op > 0 and curr_op < 0:
            signals.append({
                "type": "OP_LOSS",
                "severity": "MEDIUM",
                "description": (
                    f"영업이익 적자 전환 {prev['period']} {prev_op:,.0f} → "
                    f"{curr['period']} {curr_op:,.0f}"
                ),
            })

    # 배당 변동 (10%+ 증감)
    curr_div = curr.get("dividend_per_share")
    prev_div = prev.get("dividend_per_share")
    if curr_div is not None and prev_div is not None:
        curr_div = float(curr_div)
        prev_div = float(prev_div)
        if prev_div > 0:
            div_change_pct = (curr_div - prev_div) / prev_div * 100
            if abs(div_change_pct) >= 10:
                direction = "증가" if div_change_pct > 0 else "감소"
                signals.append({
                    "type": "DIVIDEND_CHANGE",
                    "severity": "MEDIUM",
                    "description": (
                        f"배당 {direction} {div_change_pct:+.1f}% "
                        f"({prev['period']} {prev_div:,.0f} → "
                        f"{curr['period']} {curr_div:,.0f})"
                    ),
                })

    return signals


# ──────────────────────────────────────────────────────────────────────────────
# 5. 시그널 저장 (중복 방지: 같은 종목·타입·당일 이미 존재하면 SKIP)
# ──────────────────────────────────────────────────────────────────────────────

def save_signals(stock_id: int, new_signals: list) -> int:
    """signals 테이블에 신규 시그널 삽입. 반환: 삽입 건수"""
    if not new_signals:
        return 0

    today_str = datetime.date.today().strftime("%Y-%m-%d")

    stmts = []
    for sig in new_signals:
        # 당일 동일 종목·타입 중복 방지
        existing = turso_one(
            """SELECT id FROM signals
               WHERE stock_id = ? AND type = ? AND date(detected_at) = ?""",
            [stock_id, sig["type"], today_str],
        )
        if existing:
            print(f"    [SKIP] {sig['type']} 이미 오늘 감지됨")
            continue

        stmts.append({
            "q": """INSERT INTO signals
                    (stock_id, type, severity, description, detected_at)
                    VALUES (?,?,?,?,datetime('now'))""",
            "params": [stock_id, sig["type"], sig["severity"], sig["description"]],
        })

    return turso_batch(stmts)


# ──────────────────────────────────────────────────────────────────────────────
# 6. 결과 요약 출력
# ──────────────────────────────────────────────────────────────────────────────

def print_summary(results: dict) -> None:
    print("\n" + "=" * 60)
    print("  📊 weekly_signal.py 실행 결과 요약")
    print("=" * 60)

    total_sig = 0
    for ticker, r in results.items():
        if "error" in r:
            print(f"  ❌ {ticker}: {r['error']}")
        else:
            s = r.get("signals_inserted", 0)
            total_sig += s
            badge = f" → 🟡 시그널 {s}건" if s > 0 else " → 변동 없음"
            print(f"  ✅ {ticker}{badge}")
            for sig in r.get("signals_list", []):
                severity_icon = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(sig["severity"], "⚪")
                print(f"      {severity_icon} [{sig['type']}] {sig['description']}")

    print(f"\n  합계: 시그널 {total_sig}건 신규 생성")
    print("=" * 60)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    run_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("=" * 60)
    print(f"  GSF-Investor weekly_signal.py — {run_ts}")
    print(f"  Turso: {http_url}")
    print("  모드: 집계 분석 (LOW/MEDIUM 시그널)")
    print("=" * 60)

    # 연결 테스트
    try:
        rows = turso_one("SELECT sqlite_version() AS v")
        print(f"\n✅ Turso 연결 성공 (SQLite {rows[0]['v']})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    # 활성 종목 조회
    stocks = fetch_active_stocks()
    if not stocks:
        print("[WARN] 활성 종목이 없습니다.")
        sys.exit(0)
    print(f"✅ 집계 대상: {len(stocks)}종목 — {[s['ticker'] for s in stocks]}\n")

    results = {}

    for stock in stocks:
        ticker = stock["ticker"]
        stock_id = stock["stock_id"]
        print(f"  📊 {ticker} ({stock['name']}) 분석 중...")

        try:
            new_signals = []

            # 주가 추세 분석
            price_signals = analyze_price_trend(stock)
            new_signals.extend(price_signals)

            # 재무 변화 분석
            fin_signals = analyze_financials(stock)
            new_signals.extend(fin_signals)

            if new_signals:
                for sig in new_signals:
                    sev_icon = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(sig["severity"], "⚪")
                    print(f"    {sev_icon} {sig['type']}: {sig['description'][:80]}")
            else:
                print("    → 이상 없음")

            inserted = save_signals(stock_id, new_signals)
            results[ticker] = {
                "signals_inserted": inserted,
                "signals_list": new_signals,
            }

            # MEDIUM 이상 시그널 → Telegram 알림
            important = [s for s in new_signals if s["severity"] in ("HIGH", "MEDIUM")]
            if important:
                lines = [f"📊 <b>주간 시그널 — {stock['name']} ({ticker})</b>"]
                for sig in important:
                    icon = "🔴" if sig["severity"] == "HIGH" else "🟡"
                    lines.append(f"{icon} [{sig['type']}] {sig['description']}")
                notify_telegram("\n".join(lines))

        except Exception as e:
            print(f"    [ERROR] {e}")
            results[ticker] = {"error": str(e)}

    print_summary(results)

    # 오류가 하나라도 있으면 exit code 1
    has_error = any("error" in r for r in results.values())
    if has_error:
        print("\n⚠️  일부 분석 실패 — GitHub Actions에서 경고로 처리됩니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
