"""Shared helpers for financial / valuation validation scripts (read-only)."""

from __future__ import annotations

import os
import re
from typing import Any, Optional

import requests

DART_ACCOUNT_LABELS = {
    "revenue": ["매출액", "영업수익", "수익(매출액)"],
    "op_income": ["영업이익", "영업이익(손실)"],
    "net_income": ["당기순이익", "당기순이익(손실)"],
    "total_assets": ["자산총계"],
    "total_equity": ["자본총계"],
    "cash_and_equivalents": ["현금및현금성자산"],
    "dividend_per_share": ["주당배당금"],
    "eps_dart": [
        "기본주당이익",
        "희석주당이익",
        "기본주당순이익",
        "기본주당이익(손실)",
        "희석주당이익(손실)",
        "기본주당계속영업이익(손실)",
        "계속영업기본주당순이익",
        "기본주당계속영업손익",
    ],
    "bps_dart": ["주당순자산가치", "주당순자산", "주당순자산(BPS)"],
}

REPORT_CODE_BY_SUFFIX = {
    "FY": "11011",
    "Q1": "11013",
    "Q2": "11012",
    "Q3": "11014",
}


def load_dotenv(path: str) -> None:
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


def init_env() -> tuple[str, str, str]:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(script_dir, "..", ".env.local"))
    load_dotenv(os.path.join(script_dir, "..", ".env"))
    turso_url = os.environ.get("TURSO_DATABASE_URL", "")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN", "")
    dart_key = os.environ.get("DART_API_KEY", "")
    if not turso_url or not turso_token:
        raise SystemExit("[ERROR] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN required")
    return turso_url, turso_token, dart_key


def turso_http_url(turso_url: str) -> str:
    return turso_url.replace("libsql://", "https://")


def _turso_arg(p: Any) -> dict:
    if p is None:
        return {"type": "null"}
    if isinstance(p, bool):
        return {"type": "integer", "value": "1" if p else "0"}
    if isinstance(p, int):
        return {"type": "integer", "value": str(p)}
    if isinstance(p, float):
        return {"type": "float", "value": float(p)}
    return {"type": "text", "value": str(p)}


def turso_query(http_url: str, token: str, sql: str, params: list | None = None) -> list[dict]:
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": sql,
                    "args": [_turso_arg(p) for p in (params or [])],
                },
            },
            {"type": "close"},
        ]
    }
    resp = requests.post(
        f"{http_url}/v2/pipeline",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Turso HTTP {resp.status_code}: {resp.text[:300]}")
    results = resp.json().get("results", [])
    if not results:
        return []
    res = results[0]
    if res.get("type") == "error":
        raise RuntimeError(f"SQL Error: {res}")
    rs = res.get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    out = []
    for row in rs.get("rows", []):
        out.append(
            {
                cols[i]: (v.get("value") if v.get("type") != "null" else None)
                for i, v in enumerate(row)
            }
        )
    return out


def period_to_dart(period: str) -> tuple[int, str] | None:
    m = re.match(r"^(\d{4})(FY|Q[123])$", period)
    if not m:
        return None
    year = int(m.group(1))
    suffix = m.group(2)
    code = REPORT_CODE_BY_SUFFIX.get(suffix)
    if not code:
        return None
    return year, code


def parse_dart_amount_raw(val_str: Optional[str]) -> Optional[float]:
    if not val_str or str(val_str).strip() == "":
        return None
    try:
        return float(str(val_str).replace(",", "").strip())
    except ValueError:
        return None


def parse_dart_amount_seed_portfolio(val_str: Optional[str]) -> Optional[float]:
    raw = parse_dart_amount_raw(val_str)
    if raw is None:
        return None
    return raw * 1_000_000


def fetch_dart_financials(
    dart_key: str, corp_code: str, year: int, report_code: str, fs_div: str = "CFS"
) -> Optional[dict]:
    url = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"
    params = {
        "crtfc_key": dart_key,
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
    except Exception:
        return None


def build_acc_map(data: dict) -> dict[str, str]:
    acc_map: dict[str, str] = {}
    for acc in data.get("list", []):
        label = acc.get("account_nm", "").strip()
        val = acc.get("thstrm_amount", "") or acc.get("thstrm_add_amount", "")
        acc_map[label] = val
    return acc_map


def get_amount_from_map(acc_map: dict[str, str], labels: list[str], scale: str) -> Optional[float]:
    parser = (
        parse_dart_amount_seed_portfolio if scale == "million" else parse_dart_amount_raw
    )
    for lbl in labels:
        if lbl in acc_map:
            return parser(acc_map[lbl])
    return None


def extract_dart_fields(acc_map: dict[str, str], scale: str) -> dict[str, Optional[float]]:
    out: dict[str, Optional[float]] = {}
    for field, labels in DART_ACCOUNT_LABELS.items():
        out[field] = get_amount_from_map(acc_map, labels, scale)
    return out


def pick_dart_scale(db_row: dict, dart_raw: dict[str, Optional[float]]) -> str:
    """Choose 'raw' (원) vs 'million' (seed_portfolio ×1e6) by best revenue match."""
    db_rev = db_row.get("revenue")
    if db_rev is None:
        return "raw"
    raw_rev = dart_raw.get("revenue")
    if raw_rev is None:
        return "raw"
    million_rev = raw_rev * 1_000_000 if raw_rev is not None else None
    if million_rev is not None and amounts_close(db_rev, million_rev, rel=0.01, abs_tol=1.0):
        return "million"
    if amounts_close(db_rev, raw_rev, rel=0.01, abs_tol=1.0):
        return "raw"
    # default: raw (seed_financials_only)
    return "raw"


def amounts_close(a: float, b: float, rel: float = 0.001, abs_tol: float = 1.0) -> bool:
    if a is None or b is None:
        return False
    if abs(a - b) <= abs_tol:
        return True
    denom = max(abs(a), abs(b), 1.0)
    return abs(a - b) / denom <= rel


def recompute_eps(net_income: Optional[float], shares: Optional[float]) -> Optional[float]:
    if net_income is None or not shares or shares <= 0:
        return None
    return round(net_income / shares, 2)


def recompute_bps(total_equity: Optional[float], shares: Optional[float], stored_bps: Optional[float]) -> Optional[float]:
    if stored_bps is not None:
        return stored_bps
    if total_equity is None or not shares or shares <= 0:
        return None
    return round(total_equity / shares, 2)


def recompute_debt_ratio(total_assets: Optional[float], total_equity: Optional[float]) -> Optional[float]:
    if total_equity is None or total_assets is None or total_equity == 0:
        return None
    total_liab = total_assets - total_equity
    return round(total_liab / total_equity * 100, 2)


def recompute_roe(net_income: Optional[float], total_equity: Optional[float]) -> Optional[float]:
    if net_income is None or not total_equity or total_equity <= 0:
        return None
    return round(net_income / total_equity * 100, 2)
