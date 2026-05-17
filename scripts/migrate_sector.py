#!/usr/bin/env python3
"""
sector 컬럼 마이그레이션 스크립트
stocks 테이블에 sector TEXT 컬럼을 추가하고 기존 종목에 기본값을 적용합니다.

실행:
  python scripts/migrate_sector.py
"""

import subprocess
import sys
import os

# ── Turso 연결 정보 ────────────────────────────────────────────────────────────
TURSO_DB_URL = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

if not TURSO_DB_URL or not TURSO_AUTH_TOKEN:
    print("❌ 환경변수 TURSO_DATABASE_URL, TURSO_AUTH_TOKEN 가 설정되지 않았습니다.")
    print("   .env.local 또는 export 명령으로 설정 후 재실행하세요.")
    sys.exit(1)


def turso_sql(sql: str, description: str = "") -> dict:
    """Turso HTTP API를 통해 SQL을 실행합니다."""
    import urllib.request
    import urllib.error
    import json

    url = f"{TURSO_DB_URL}/v2/pipeline"
    payload = json.dumps(
        {"requests": [{"type": "execute", "stmt": {"sql": sql}}, {"type": "close"}]}
    ).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            if description:
                print(f"  ✅ {description}")
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ❌ {description or sql}: HTTP {e.code} — {body}")
        return {}


def main():
    print("🔧 Sector 컬럼 마이그레이션 시작\n")

    # 1. sector 컬럼 추가 (이미 존재하면 무시)
    print("1. stocks 테이블에 sector 컬럼 추가")
    result = turso_sql(
        "ALTER TABLE stocks ADD COLUMN sector TEXT",
        "sector 컬럼 추가",
    )
    # SQLite는 이미 있는 컬럼 추가 시 에러 반환 — 무시
    if not result:
        print("  ℹ️  이미 존재하거나 실패 — 계속 진행합니다.")

    # 2. 기존 종목 기본 섹터 설정
    print("\n2. 기존 종목 섹터 기본값 적용")
    sector_map = [
        ("026960", "Food & Beverage"),   # 동서
        ("059090", "Technology"),         # 미코 (반도체 세라믹)
        ("MDLZ",   "Food & Beverage"),   # Mondelez
        ("069500", "ETF"),                # KODEX 200
    ]

    for ticker, sector in sector_map:
        turso_sql(
            f"UPDATE stocks SET sector = '{sector}' WHERE ticker = '{ticker}' AND (sector IS NULL OR sector = '')",
            f"{ticker} → {sector}",
        )

    # 3. 결과 확인
    print("\n3. 현재 상태 확인")
    result = turso_sql(
        "SELECT ticker, name, sector FROM stocks ORDER BY id",
        "종목 목록",
    )

    import json
    rows = result.get("results", [{}])[0].get("response", {}).get("result", {}).get("rows", [])
    print(f"\n  {'TICKER':<12} {'NAME':<20} {'SECTOR':<25}")
    print(f"  {'-'*12} {'-'*20} {'-'*25}")
    for row in rows:
        ticker = row[0].get("value", "") if isinstance(row[0], dict) else str(row[0])
        name   = row[1].get("value", "") if isinstance(row[1], dict) else str(row[1])
        sector = row[2].get("value", "—") if isinstance(row[2], dict) else str(row[2])
        print(f"  {ticker:<12} {name:<20} {sector:<25}")

    print("\n✅ 마이그레이션 완료!")
    print("ℹ️  Settings 페이지에서 각 종목의 섹터를 수동 편집하거나 설정 API를 통해 일괄 수정할 수 있습니다.")


if __name__ == "__main__":
    main()
