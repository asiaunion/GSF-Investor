import os
import requests
import json
def load_dotenv(path):
    if not os.path.exists(path): return
    with open(path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k.strip()] = v.strip().strip("'\"")

load_dotenv(".env.local")
TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "").replace("libsql://", "https://")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

def turso_exec(sql, params=[]):
    payload = {"requests": [
        {"type": "execute", "stmt": {"sql": sql, "args": [{"type": "integer", "value": str(p)} if isinstance(p, int) else {"type": "text", "value": str(p)} for p in params]}},
        {"type": "close"}
    ]}
    resp = requests.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json=payload
    )
    rs = resp.json().get("results", [])[0].get("response", {}).get("result", {})
    return rs.get("affected_row_count", 0)

import yfinance as yf
dongsuh = yf.Ticker("026960.KS").info.get("sharesOutstanding")
mico = yf.Ticker("059090.KQ").info.get("sharesOutstanding")

print("Updating Dongsuh:", dongsuh)
if dongsuh:
    affected = turso_exec("UPDATE financials SET shares_outstanding = ?, bps = ROUND(total_equity / ?, 2) WHERE stock_id = 1 AND total_equity IS NOT NULL", [int(dongsuh), float(dongsuh)])
    print("Dongsuh updated rows:", affected)

print("Updating Mico:", mico)
if mico:
    affected = turso_exec("UPDATE financials SET shares_outstanding = ?, bps = ROUND(total_equity / ?, 2) WHERE stock_id = 3 AND total_equity IS NOT NULL", [int(mico), float(mico)])
    print("Mico updated rows:", affected)
