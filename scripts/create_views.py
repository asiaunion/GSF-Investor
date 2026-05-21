#!/usr/bin/env python3
"""
GSF-Investor — create_views.py
==============================
Turso DB에 수동 생성이 필요한 SQLite View들을 생성/재생성합니다.
Drizzle ORM이 아직 View를 지원하지 않으므로, 이 스크립트로 직접 생성합니다.

실행:
  python3 scripts/create_views.py

실데이터 안전 장치:
  REAL_DATA_RUN_ACK=I_ACK_PROD_WRITE — 원격 DB에서 DROP/CREATE VIEW 전 필수.
  DRY_RUN=1 — 뷰 DDL 생략.
"""

import os
import sys
import requests

# ─── .env.local 로드 ──────────────────────────────────────────────────────────

def load_dotenv(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k not in os.environ:
                os.environ[k] = v

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, "..", ".env.local"))
load_dotenv(os.path.join(_script_dir, "..", ".env"))

from real_data_guard import enforce_remote_write_guard, is_dry_run

TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 없습니다.")
    sys.exit(1)

http_url = TURSO_URL.replace("libsql://", "https://")

# ─── Turso HTTP 헬퍼 ─────────────────────────────────────────────────────────

def exec_sql(sql: str) -> dict:
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {TURSO_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "requests": [
                {"type": "execute", "stmt": {"sql": sql, "args": []}},
                {"type": "close"},
            ]
        },
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json()["results"][0]


def create_view(name: str, sql: str) -> None:
    if is_dry_run():
        print(f"  [DRY_RUN] skip view {name}")
        return
    print(f"  {name} DROP 중...")
    drop_res = exec_sql(f"DROP VIEW IF EXISTS {name}")
    if drop_res.get("type") == "error":
        print(f"  ❌ DROP 실패: {drop_res['error']['message']}")
        return

    print(f"  {name} CREATE 중...")
    create_res = exec_sql(sql)
    if create_res.get("type") == "error":
        print(f"  ❌ CREATE 실패: {create_res['error']['message']}")
    else:
        print(f"  ✅ {name} 생성 완료")


# ─── View 정의 ────────────────────────────────────────────────────────────────

VIEWS = {
    # ── 현재 보유 포트폴리오 ──────────────────────────────────────────────────
    "v_portfolio": """
CREATE VIEW IF NOT EXISTS v_portfolio AS
WITH positions AS (
  SELECT
    stock_id,
    SUM(CASE WHEN action IN ('BUY', 'INIT') THEN quantity ELSE -quantity END) AS quantity,
    SUM(CASE WHEN action IN ('BUY', 'INIT') THEN quantity * price ELSE 0 END) AS total_cost,
    SUM(CASE WHEN action IN ('BUY', 'INIT') THEN quantity ELSE 0 END) AS total_bought,
    MAX(currency) AS currency
  FROM trade_journal
  GROUP BY stock_id
  HAVING quantity > 0
)
SELECT
  p.stock_id,
  s.ticker,
  s.name,
  s.market,
  s.category,
  s.broker,
  p.quantity,
  ROUND(p.total_cost / p.total_bought, 0) AS avg_price,
  p.currency
FROM positions p
JOIN stocks s ON s.id = p.stock_id
WHERE s.is_active = 1
""",

    # ── 전체 거래 이력 + 실현 손익 (전량 매도 포함) ──────────────────────────
    "v_portfolio_history": """
CREATE VIEW IF NOT EXISTS v_portfolio_history AS
WITH
  buy_summary AS (
    SELECT
      stock_id,
      SUM(quantity)            AS total_bought,
      SUM(quantity * price)    AS total_cost,
      MIN(traded_at)           AS first_bought_at,
      MAX(traded_at)           AS last_bought_at
    FROM trade_journal
    WHERE action IN ('BUY', 'INIT')
    GROUP BY stock_id
  ),
  sell_summary AS (
    SELECT
      stock_id,
      SUM(quantity)            AS total_sold,
      SUM(quantity * price)    AS total_proceeds,
      MAX(traded_at)           AS last_sold_at
    FROM trade_journal
    WHERE action = 'SELL'
    GROUP BY stock_id
  )
SELECT
  s.id          AS stock_id,
  s.ticker,
  s.name,
  s.market,
  s.category,
  b.total_bought,
  COALESCE(ss.total_sold, 0)                                    AS total_sold,
  b.total_bought - COALESCE(ss.total_sold, 0)                   AS remaining_qty,
  ROUND(b.total_cost / b.total_bought, 0)                       AS avg_buy_price,
  CASE WHEN ss.total_sold > 0
       THEN ROUND(ss.total_proceeds / ss.total_sold, 0)
       ELSE NULL
  END                                                            AS avg_sell_price,
  COALESCE(ss.total_proceeds, 0)                                 AS total_proceeds,
  b.total_cost                                                   AS total_cost,
  CASE WHEN ss.total_sold > 0
       THEN ss.total_proceeds - b.total_cost
       ELSE NULL
  END                                                            AS realized_pnl,
  CASE WHEN ss.total_sold > 0 AND b.total_cost > 0
       THEN ROUND((ss.total_proceeds - b.total_cost) / b.total_cost * 100, 2)
       ELSE NULL
  END                                                            AS realized_pnl_pct,
  b.first_bought_at,
  b.last_bought_at,
  ss.last_sold_at,
  CASE WHEN b.total_bought <= COALESCE(ss.total_sold, 0) THEN 1 ELSE 0 END AS is_closed
FROM stocks s
JOIN buy_summary b ON b.stock_id = s.id
LEFT JOIN sell_summary ss ON ss.stock_id = s.id
""",
}


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="create_views.py")
    print("=" * 60)
    print("  GSF-Investor — Turso View 생성 스크립트")
    print("=" * 60)

    # 연결 테스트
    try:
        test = exec_sql("SELECT sqlite_version() AS v")
        rs = test["response"]["result"]
        ver = rs["rows"][0][0]["value"]
        print(f"\n✅ Turso 연결 성공 (SQLite {ver})\n")
    except Exception as e:
        print(f"\n[ERROR] Turso 연결 실패: {e}")
        sys.exit(1)

    for name, sql in VIEWS.items():
        create_view(name, sql)

    print("\n✅ 모든 View 생성 완료")


if __name__ == "__main__":
    main()
