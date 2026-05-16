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

def turso_exec(sql):
    resp = requests.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json={"requests": [{"type": "execute", "stmt": {"sql": sql}}, {"type": "close"}]}
    )
    rs = resp.json().get("results", [])[0].get("response", {}).get("result", {})
    cols = [c["name"] for c in rs.get("cols", [])]
    return [{cols[i]: (v.get("value") if v.get("type") != "null" else None) for i, v in enumerate(row)} for row in rs.get("rows", [])]

print("BPS Data:")
print(turso_exec("SELECT period, bps, shares_outstanding FROM financials WHERE stock_id=1 ORDER BY period DESC LIMIT 3"))
print("Dividends Data:")
print(turso_exec("SELECT date, dividend FROM prices WHERE stock_id=1 AND dividend > 0 ORDER BY date DESC LIMIT 5"))
