#!/usr/bin/env python3
"""
KODEX 200 (069500) 벤치마크 ETF를 관심종목에 즉시 추가하는 스크립트.
Alpha 계산 활성화를 위한 1회성 실행.

실행:
    python3 scripts/add_benchmark.py
"""

import os
import sys
import requests

def load_dotenv(path):
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

_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_dir, "..", ".env.local"))
load_dotenv(os.path.join(_dir, "..", ".env"))

from real_data_guard import enforce_remote_write_guard, is_dry_run

TURSO_URL   = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

if not TURSO_URL or not TURSO_TOKEN:
    print("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수 없음")
    sys.exit(1)

http_url = TURSO_URL.replace("libsql://", "https://")

def turso_exec(sql, params=None):
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": sql,
                    "args": [
                        ({"type": "null"} if p is None else {"type": "text", "value": str(p)})
                        for p in (params or [])
                    ],
                },
            },
            {"type": "close"},
        ]
    }
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("results", [])


def main():
    enforce_remote_write_guard(database_url=TURSO_URL, script_name="add_benchmark.py")

    # 1. 중복 확인
    results = turso_exec("SELECT id, ticker FROM stocks WHERE ticker = ?", ["069500"])
    rs = results[0].get("response", {}).get("result", {})
    rows = rs.get("rows", [])
    if rows:
        print("✅ 069500(KODEX 200)은 이미 등록되어 있습니다.")
        print(f"   id={rows[0][0]['value']}, ticker={rows[0][1]['value']}")
        return

    # 2. 종목 추가
    if is_dry_run():
        print("[DRY_RUN] KODEX 200 INSERT 를 건너뜁니다.")
        return

    turso_exec(
        """INSERT INTO stocks
           (ticker, yahoo_ticker, dart_corp_code, name, market, category, thesis)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [
            "069500",
            "069500.KS",
            None,                     # ETF이므로 DART Corp Code 불필요
            "KODEX 200",
            "KR",
            "Core",                   # 벤치마크용 분류 (대시보드 비중에는 포함하지 않음)
            "KOSPI 200 벤치마크 ETF — Alpha 계산 기준선",
        ],
    )

    # 3. 확인
    results2 = turso_exec("SELECT id FROM stocks WHERE ticker = ?", ["069500"])
    rs2 = results2[0].get("response", {}).get("result", {})
    rows2 = rs2.get("rows", [])
    if rows2:
        stock_id = rows2[0][0]["value"]
        print(f"✅ 069500(KODEX 200) 추가 완료! id={stock_id}")
        print()
        print("다음 단계:")
        print("  1. python3 scripts/daily_price.py  → 069500.KS 주가 수집")
        print("  2. 대시보드 새로고침 → Alpha 값 표시")
    else:
        print("[ERROR] 추가 실패")


if __name__ == "__main__":
    main()
