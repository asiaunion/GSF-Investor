#!/usr/bin/env python3
"""
1회 시트 → wealth_positions / stock_loans seed import.
- 스킵: 분류=주식
- 예수금: 증권사(broker)별 1행
- 주식담보대출: stock_loans (broker in label)

Usage:
  python3 scripts/import_wealth_from_sheets.py --from-mock
  python3 scripts/import_wealth_from_sheets.py  # GSHEETS_CSV_URL or GCP
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import sqlite3
import sys
from typing import Any, Optional

import requests

_script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _script_dir)

from financial_validation_lib import init_env, turso_http_url, turso_query
from real_data_guard import enforce_remote_write_guard, is_dry_run

# Portfolio 앱 mock과 동일 (주식 행 제외 시 import)
MOCK_CSV = """분류,통화,증권사,종목명,종목코드,수량,매입단가,평가금액
예수금,KRW,대신증권(크레온),예수금(현금),cash,1,3033551,3033551
예수금,KRW,키움증권,예수금(현금),cash,1,13700,13700
예수금,KRW,미래에셋증권,예수금(현금),cash,1,27816,27816
주식담보대출,KRW,미래에셋증권,동서,026960.KS,,,535250
주식담보대출,KRW,키움증권,동서,026960.KS,,,20263900
주식담보대출,KRW,키움증권,동서,026960.KS,,,10094300
주식담보대출,KRW,대신증권(크레온),동서,026960.KS,,,26090000
주택담보대출,KRW,신한은행,신용빌라202호,-,0,0,26639928
주택담보대출,KRW,신한은행,태산APT 324호,-,0,0,34560000
주택담보대출,KRW,KB국민,신용빌라201호,-,0,0,8552688
기타대출,KRW,NH농협,비상금대출,-,0,0,2583335
기타대출,KRW,K뱅크,쏙대출,-,0,0,2810829
학자금대출,KRW,한국장학재단,학자금 대출,-,0,0,21260908
카드(장기)대출,KRW,신한카드,스피드론 플러스 (1),-,0,0,10535462
카드(장기)대출,KRW,신한카드,스피드론 플러스 (2),-,0,0,3607598
카드(장기)대출,KRW,신한카드,스피드론 플러스 (3),-,0,0,3431789
부동산시세,KRW,,태산(324호) 시세,-,1,,120000000
부동산시세,KRW,,신용(201호) 시세,-,1,,80000000
부동산시세,KRW,,신용(202호) 시세,-,1,,80000000
부동산 보증금,KRW,,태산(324호) 보증금,,1,0,50000000
부동산 보증금,KRW,,신용(201호) 보증금,,1,0,30000000
부동산 보증금,KRW,,신용(202호) 보증금,-,1,0,30000000
"""


def load_dotenv_local() -> None:
    for name in (".env.local", ".env"):
        path = os.path.join(_script_dir, "..", name)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k not in os.environ:
                    os.environ[k] = v


def infer_big_category(category: str) -> str:
    c = category.strip()
    if any(k in c for k in ("주택담보", "주식담보", "카드", "학자금", "대출", "보증금")):
        if "부동산시세" in c:
            return "부동산"
        if c == "예수금":
            return "유가증권 및 현금"
        return "대출 및 부채"
    if "부동산" in c:
        return "부동산"
    return "유가증권 및 현금"


def is_liability(category: str) -> bool:
    c = category.strip()
    if c == "예수금":
        return False
    if "부동산시세" in c:
        return False
    return any(k in c for k in ("담보", "대출", "카드", "학자금", "론")) or (
        "보증금" in c and "부동산시세" not in c
    )


def clean_num(s: str) -> float:
    if not s:
        return 0.0
    try:
        return float(str(s).replace(",", "").strip())
    except ValueError:
        return 0.0


def fetch_sheet_rows(use_mock: bool) -> list[dict[str, str]]:
    if use_mock:
        reader = csv.DictReader(io.StringIO(MOCK_CSV))
        return list(reader)

    rows: list[dict[str, str]] = []
    client_email = os.environ.get("GCP_CLIENT_EMAIL")
    private_key = os.environ.get("GCP_PRIVATE_KEY", "").replace("\\n", "\n")
    sheet_id = os.environ.get("GSHEETS_ID") or (
        (os.environ.get("GSHEETS_CSV_URL") or "").split("/d/")[1].split("/")[0]
        if "/d/" in (os.environ.get("GSHEETS_CSV_URL") or "")
        else None
    )

    if client_email and private_key and sheet_id:
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import service_account

            creds = service_account.Credentials.from_service_account_info(
                {
                    "type": "service_account",
                    "client_email": client_email,
                    "private_key": private_key,
                    "token_uri": "https://oauth2.googleapis.com/token",
                },
                scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
            )
            creds.refresh(Request())
            token = creds.token
            api_url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/A:H"
            resp = requests.get(
                api_url,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            if resp.ok:
                values = resp.json().get("values", [])
                if len(values) > 1:
                    headers = [str(h) for h in values[0]]
                    for row in values[1:]:
                        obj = {
                            headers[i]: str(row[i]) if i < len(row) else ""
                            for i in range(len(headers))
                        }
                        rows.append(obj)
                    return rows
        except ImportError:
            print("[WARN] google-auth not installed — pip install google-auth")
        except Exception as e:
            print(f"[WARN] Google Sheets API: {e}")

    url = os.environ.get("GSHEETS_CSV_URL", "")
    if url and "docs.google.com" in url and "/edit" in url:
        url = url.replace("/edit", "/export?format=csv").split("?")[0]
        if "export" not in url:
            url = url.rstrip("/") + "/export?format=csv"

    if url:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        reader = csv.DictReader(io.StringIO(resp.text))
        return list(reader)

    print("[ERROR] No sheet data — use --from-mock or set GSHEETS_CSV_URL / GCP_*")
    sys.exit(1)


def row_value_krw(row: dict) -> float:
    eval_p = clean_num(row.get("평가금액", "") or row.get("evaluation", ""))
    if eval_p > 0:
        return eval_p
    qty = clean_num(row.get("수량", "") or "1")
    price = clean_num(row.get("매입단가", "") or "0")
    return qty * price if qty and price else 0.0


def _is_local_db(url: str) -> bool:
    return url.startswith("file:")


def _local_db_path(url: str) -> str:
    return url.replace("file:", "", 1)


def upsert_wealth_local(
    db_path: str,
    category: str,
    broker: str,
    name: str,
    value_krw: float,
    ticker: str = "",
    quantity: float = 1,
    book_value: Optional[float] = None,
) -> None:
    big = infer_big_category(category)
    liab = 1 if is_liability(category) else 0
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO wealth_positions
          (category, big_category, broker, name, ticker, quantity, book_value,
           value_krw, currency, is_liability, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, 1, datetime('now'))
        ON CONFLICT(broker, category, name) DO UPDATE SET
          big_category=excluded.big_category,
          value_krw=excluded.value_krw,
          quantity=excluded.quantity,
          book_value=excluded.book_value,
          is_liability=excluded.is_liability,
          updated_at=datetime('now')
        """,
        (
            category,
            big,
            broker or "",
            name,
            ticker or None,
            quantity,
            book_value,
            value_krw,
            liab,
        ),
    )
    conn.commit()
    conn.close()


def insert_stock_loan_local(db_path: str, broker: str, amount: float, name: str) -> None:
    label = f"주식담보대출 ({broker})" if broker else "주식담보대출"
    conn = sqlite3.connect(db_path)
    cur = conn.execute(
        "SELECT id FROM stock_loans WHERE label = ? AND loan_amount = ? LIMIT 1",
        (label, amount),
    )
    if cur.fetchone():
        conn.close()
        print(f"  ⏭️  loan exists: {label} {amount}")
        return
    conn.execute(
        """
        INSERT INTO stock_loans (label, loan_amount, interest_rate, is_active, note)
        VALUES (?, ?, 0, 1, ?)
        """,
        (label, amount, f"imported from sheet — {name}"),
    )
    conn.commit()
    conn.close()


def upsert_wealth(
    http_url: str,
    token: str,
    category: str,
    broker: str,
    name: str,
    value_krw: float,
    ticker: str = "",
    quantity: float = 1,
    book_value: Optional[float] = None,
) -> None:
    big = infer_big_category(category)
    liab = 1 if is_liability(category) else 0
    turso_query(
        http_url,
        token,
        """
        INSERT INTO wealth_positions
          (category, big_category, broker, name, ticker, quantity, book_value,
           value_krw, currency, is_liability, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'KRW', ?, 1, datetime('now'))
        ON CONFLICT(broker, category, name) DO UPDATE SET
          big_category=excluded.big_category,
          value_krw=excluded.value_krw,
          quantity=excluded.quantity,
          book_value=excluded.book_value,
          is_liability=excluded.is_liability,
          updated_at=datetime('now')
        """,
        [
            category,
            big,
            broker or "",
            name,
            ticker or None,
            quantity,
            book_value,
            value_krw,
            liab,
        ],
    )


def insert_stock_loan(
    http_url: str,
    token: str,
    broker: str,
    amount: float,
    name: str,
) -> None:
    label = f"주식담보대출 ({broker})" if broker else "주식담보대출"
    existing = turso_query(
        http_url,
        token,
        "SELECT id FROM stock_loans WHERE label = ? AND loan_amount = ? LIMIT 1",
        [label, amount],
    )
    if existing:
        print(f"  ⏭️  loan exists: {label} {amount}")
        return
    turso_query(
        http_url,
        token,
        """
        INSERT INTO stock_loans (label, loan_amount, interest_rate, is_active, note)
        VALUES (?, ?, 0, 1, ?)
        """,
        [label, amount, f"imported from sheet — {name}"],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-mock", action="store_true", help="Use built-in sample CSV")
    args = parser.parse_args()

    load_dotenv_local()
    turso_url, turso_token, _ = init_env()
    enforce_remote_write_guard(database_url=turso_url, script_name="import_wealth_from_sheets.py")
    if is_dry_run():
        print("[DRY_RUN] Would import rows — no writes.")
        sys.exit(0)

    http_url = turso_http_url(turso_url) if not _is_local_db(turso_url) else ""
    local_path = _local_db_path(turso_url) if _is_local_db(turso_url) else ""
    rows = fetch_sheet_rows(args.from_mock)
    print(f"Loaded {len(rows)} sheet rows")

    imported = skipped = 0
    for row in rows:
        category = (row.get("분류") or row.get("category") or "").strip()
        if not category or category == "주식":
            skipped += 1
            continue

        broker = (row.get("증권사") or row.get("broker") or "").strip() or None
        name = (row.get("종목명") or row.get("name") or "알 수 없음").strip()
        ticker = (row.get("종목코드") or row.get("ticker") or "").strip()
        value = row_value_krw(row)
        if value <= 0 and "담보" not in category and "대출" not in category:
            skipped += 1
            continue

        if "주식담보" in category:
            if local_path:
                insert_stock_loan_local(local_path, broker or "", value, name)
            else:
                insert_stock_loan(http_url, turso_token, broker or "", value, name)
            imported += 1
            print(f"  ✓ loan {broker} {value:,.0f}")
            continue

        if local_path:
            upsert_wealth_local(
                local_path,
                category,
                broker or "",
                name,
                value,
                ticker=ticker,
                quantity=clean_num(row.get("수량", "1")) or 1,
                book_value=clean_num(row.get("매입단가", "")) or None,
            )
        else:
            upsert_wealth(
                http_url,
                turso_token,
                category,
                broker or "",
                name,
                value,
                ticker=ticker,
                quantity=clean_num(row.get("수량", "1")) or 1,
                book_value=clean_num(row.get("매입단가", "")) or None,
            )
        imported += 1
        print(f"  ✓ {category} | {broker} | {name} | {value:,.0f}")

    print(f"\nDone: imported={imported} skipped={skipped} (주식 행 포함)")


if __name__ == "__main__":
    main()
