#!/usr/bin/env python3
"""
GSF-Investor — data_provider.py (Phase A3)
==========================================
어댑터 패턴으로 주가 데이터 공급자를 추상화.
Yahoo Finance 실패 시 FMP(Financial Modeling Prep) → Fallback 순으로 전환.

사용법:
    from data_provider import get_price, get_fx_rate

    result = get_price("026960.KS", currency="KRW")
    # → {"close": 28500.0, "date": "2026-05-16", "source": "yahoo"}
    # 또는 {"close": 28500.0, "date": "2026-05-16", "source": "fmp"}
    # 실패 시 → None

환경변수 (optional):
    FMP_API_KEY   — Financial Modeling Prep API 키 (무료 250req/day)
                    https://site.financialmodelingprep.com/developer/docs/
"""

import os
import sys
import time
import datetime
from typing import Optional
import requests

# ─────────────────────────────────────────────────────────────
# 공통 설정
# ─────────────────────────────────────────────────────────────

FMP_API_KEY = os.environ.get("FMP_API_KEY", "")

RETRY_DELAY   = 1.0   # 재시도 전 대기 (초)
REQUEST_TIMEOUT = 15  # HTTP 요청 타임아웃 (초)


# ─────────────────────────────────────────────────────────────
# 공급자 1: Yahoo Finance (yfinance)
# ─────────────────────────────────────────────────────────────

def _yahoo_get_price(yahoo_ticker: str) -> Optional[dict]:
    """
    yfinance로 최근 종가를 가져옵니다.
    반환: {"close": float, "date": str, "source": "yahoo"} 또는 None
    """
    try:
        import yfinance as yf
        import pandas as pd
    except ImportError:
        print("[data_provider] yfinance 미설치 — pip install yfinance")
        return None

    try:
        hist = yf.download(
            yahoo_ticker,
            period="5d",
            auto_adjust=True,
            progress=False,
        )
        if hist is None or hist.empty:
            print(f"[data_provider/yahoo] {yahoo_ticker}: 데이터 없음")
            return None

        # MultiIndex 컬럼 정리
        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.droplevel(1)

        latest = hist.iloc[-1]
        date   = hist.index[-1].strftime("%Y-%m-%d")
        close_raw = latest["Close"]
        close = float(close_raw.item()) if hasattr(close_raw, "item") else float(close_raw)

        return {"close": close, "date": date, "source": "yahoo"}

    except Exception as e:
        print(f"[data_provider/yahoo] {yahoo_ticker} 오류: {e}")
        return None


def _yahoo_get_fx(pair: str = "USDKRW=X") -> Optional[dict]:
    """Yahoo Finance 환율 조회."""
    try:
        import yfinance as yf
        import pandas as pd
    except ImportError:
        return None

    try:
        hist = yf.download(pair, period="5d", auto_adjust=True, progress=False)
        if hist is None or hist.empty:
            return None
        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.droplevel(1)
        latest = hist.iloc[-1]
        date   = hist.index[-1].strftime("%Y-%m-%d")
        rate   = float(latest["Close"].item()) if hasattr(latest["Close"], "item") else float(latest["Close"])
        return {"rate": rate, "date": date, "source": "yahoo"}
    except Exception as e:
        print(f"[data_provider/yahoo] {pair} 환율 오류: {e}")
        return None


# ─────────────────────────────────────────────────────────────
# 공급자 2: Financial Modeling Prep (FMP) — 폴백
# ─────────────────────────────────────────────────────────────
# 무료 API 한도: 250 req/day
# 한국 종목: "026960.KS" → FMP ticker는 "026960.KS" 그대로 사용 가능

def _fmp_get_price(ticker: str) -> Optional[dict]:
    """
    FMP API로 최근 종가를 가져옵니다.
    ticker: Yahoo 형식("026960.KS", "AAPL") 그대로 전달
    반환: {"close": float, "date": str, "source": "fmp"} 또는 None
    """
    if not FMP_API_KEY:
        print("[data_provider/fmp] FMP_API_KEY 환경변수 없음 — 폴백 불가")
        return None

    try:
        url = f"https://financialmodelingprep.com/api/v3/quote-short/{ticker}"
        resp = requests.get(url, params={"apikey": FMP_API_KEY}, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            print(f"[data_provider/fmp] HTTP {resp.status_code}")
            return None

        data = resp.json()
        if not data or not isinstance(data, list):
            print(f"[data_provider/fmp] {ticker}: 빈 응답")
            return None

        item = data[0]
        close = float(item.get("price", 0))
        if close <= 0:
            return None

        # FMP quote-short는 date 미포함 → 오늘 날짜 사용
        date = datetime.date.today().strftime("%Y-%m-%d")
        return {"close": close, "date": date, "source": "fmp"}

    except Exception as e:
        print(f"[data_provider/fmp] {ticker} 오류: {e}")
        return None


def _fmp_get_fx() -> Optional[dict]:
    """FMP에서 USDKRW 환율 조회."""
    if not FMP_API_KEY:
        return None
    try:
        url = "https://financialmodelingprep.com/api/v3/fx/USDKRW"
        resp = requests.get(url, params={"apikey": FMP_API_KEY}, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data or not isinstance(data, list):
            return None
        item = data[0]
        rate = float(item.get("bid", 0) or item.get("ask", 0))
        if rate <= 0:
            return None
        date = datetime.date.today().strftime("%Y-%m-%d")
        return {"rate": rate, "date": date, "source": "fmp"}
    except Exception as e:
        print(f"[data_provider/fmp] USDKRW 오류: {e}")
        return None


# ─────────────────────────────────────────────────────────────
# 공급자 3: 한국투자증권 오픈API (선택 — 미래 확장용)
# ─────────────────────────────────────────────────────────────
# 현재는 stub만 정의. KIS_APP_KEY, KIS_APP_SECRET 환경변수 설정 시 활성화 가능.

def _kis_get_price(ticker: str) -> Optional[dict]:
    """
    한국투자증권 오픈API — 현재 Stub.
    TODO: KIS_APP_KEY, KIS_APP_SECRET 환경변수로 OAuth 토큰 발급 후 구현.
    https://apiportal.koreainvestment.com/apiservice/oauth2#L_5c87ba63-740a-4166-93ac-803510bb9c02
    """
    kis_key = os.environ.get("KIS_APP_KEY", "")
    if not kis_key:
        return None  # 환경변수 없으면 조용히 None 반환
    # 미구현 — 필요 시 아래 로직 추가
    print("[data_provider/kis] 구현 예정")
    return None


# ─────────────────────────────────────────────────────────────
# 공개 인터페이스 (daily_price.py에서 호출)
# ─────────────────────────────────────────────────────────────

def get_price(yahoo_ticker: str, currency: str = "KRW") -> Optional[dict]:
    """
    주가 조회 (어댑터 패턴).
    공급자 순서: Yahoo Finance → FMP → KIS → None

    Args:
        yahoo_ticker: Yahoo Finance 티커 (예: "026960.KS", "AAPL")
        currency: "KRW" 또는 "USD" (로깅용)

    Returns:
        {"close": float, "date": str, "source": str} 또는 None
    """
    print(f"  📥 {yahoo_ticker} ({currency}) 조회 중...", end=" ", flush=True)

    # 1차: Yahoo Finance
    result = _yahoo_get_price(yahoo_ticker)
    if result:
        print(f"✅ [{result['source']}] {result['date']} close={result['close']:,.0f}")
        return result

    # 2차: FMP 폴백
    print(f"  ⚠️  Yahoo 실패 → FMP 폴백...", end=" ", flush=True)
    time.sleep(RETRY_DELAY)
    result = _fmp_get_price(yahoo_ticker)
    if result:
        print(f"✅ [{result['source']}] {result['date']} close={result['close']:,.0f}")
        return result

    # 3차: KIS 폴백 (stub)
    result = _kis_get_price(yahoo_ticker)
    if result:
        return result

    print(f"  ❌ {yahoo_ticker}: 모든 공급자 실패")
    return None


def get_fx_rate(pair: str = "USDKRW") -> Optional[dict]:
    """
    환율 조회 (어댑터 패턴).
    공급자 순서: Yahoo Finance → FMP → None

    Args:
        pair: "USDKRW" (현재 지원)

    Returns:
        {"rate": float, "date": str, "source": str} 또는 None
    """
    yahoo_pair = "USDKRW=X" if pair == "USDKRW" else pair

    print(f"  📥 {pair} 환율 조회 중...", end=" ", flush=True)

    # 1차: Yahoo
    result = _yahoo_get_fx(yahoo_pair)
    if result:
        print(f"✅ [{result['source']}] {result['date']} rate={result['rate']:.2f}")
        return result

    # 2차: FMP
    print(f"  ⚠️  Yahoo 실패 → FMP 폴백...", end=" ", flush=True)
    time.sleep(RETRY_DELAY)
    result = _fmp_get_fx()
    if result:
        print(f"✅ [{result['source']}] {result['date']} rate={result['rate']:.2f}")
        return result

    print(f"  ❌ {pair}: 모든 공급자 실패")
    return None


# ─────────────────────────────────────────────────────────────
# 단독 실행 테스트
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("=== data_provider.py 어댑터 테스트 ===\n")

    # 종목 테스트
    test_tickers = [
        ("026960.KS", "KRW"),  # 동서
        ("059090.KQ", "KRW"),  # 미코
        ("AAPL",      "USD"),  # Apple
    ]
    for yt, cur in test_tickers:
        r = get_price(yt, cur)
        print(f"  결과: {json.dumps(r, ensure_ascii=False)}\n")

    # 환율 테스트
    fx = get_fx_rate("USDKRW")
    print(f"  환율 결과: {json.dumps(fx, ensure_ascii=False)}\n")

    print("=== 테스트 완료 ===")
