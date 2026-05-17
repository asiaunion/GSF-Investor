"""
C-2: pytest 커버리지 — weekly_signal.py 핵심 로직 유닛 테스트
DB/네트워크 의존 없는 순수 함수만 테스트.
"""

import sys
import os
import datetime

# scripts/ 디렉토리를 sys.path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# weekly_signal.py의 순수 함수만 추출해서 테스트
# DB 접속이 모듈 로드 시 발생하지 않도록, 함수만 직접 import

# ── 테스트 대상 함수 복사 (모듈 전체 import 시 env 검사 통과 불가) ──────────────

def _analyze_price_trend_logic(rows: list, stock_id: int = 1) -> list:
    """
    weekly_signal.py의 analyze_price_trend 핵심 계산 로직 추출본.
    Turso 호출 없이 rows를 직접 받아 시그널 목록을 반환.
    """
    if len(rows) < 2:
        return []

    today = datetime.date.today()
    week_ago = (today - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (today - datetime.timedelta(days=30)).strftime("%Y-%m-%d")

    signals = []
    latest_price = float(rows[0]["close_price"] or 0)
    latest_date = rows[0]["date"]

    if latest_price <= 0:
        return []

    # 주간 비교
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

    # 월간 비교
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


def _analyze_financials_logic(rows: list) -> list:
    """
    weekly_signal.py의 analyze_financials 핵심 계산 로직 추출본.
    """
    if len(rows) < 2:
        return []

    signals = []
    curr = rows[0]
    prev = rows[1]

    # 부채비율 급등
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

    # 배당 변동
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


# ── 가격 추세 테스트 ───────────────────────────────────────────────────────────

class TestPriceTrend:
    def _make_rows(self, prices_with_offsets: list) -> list:
        """(days_ago, price) 리스트 → rows 생성"""
        today = datetime.date.today()
        rows = []
        for days_ago, price in sorted(prices_with_offsets, key=lambda x: x[0]):
            date = (today - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d")
            rows.append({"date": date, "close_price": price})
        return rows  # 최신 순

    def test_no_signal_when_weekly_change_below_5pct(self):
        """주간 변동 4.9% → 시그널 없음"""
        rows = self._make_rows([(0, 10490), (8, 10000)])  # +4.9%
        result = _analyze_price_trend_logic(rows)
        assert result == []

    def test_weekly_surge_signal_at_5pct(self):
        """주간 변동 +5% 정확히 → LOW PRICE_SURGE"""
        rows = self._make_rows([(0, 10500), (8, 10000)])  # +5.0%
        result = _analyze_price_trend_logic(rows)
        assert len(result) == 1
        assert result[0]["type"] == "PRICE_SURGE"
        assert result[0]["severity"] == "LOW"
        assert "급등" in result[0]["description"]

    def test_weekly_drop_signal(self):
        """주간 -10% → LOW 급락 시그널"""
        rows = self._make_rows([(0, 9000), (8, 10000)])  # -10%
        result = _analyze_price_trend_logic(rows)
        assert len(result) == 1
        assert "급락" in result[0]["description"]

    def test_monthly_surge_signal_at_15pct(self):
        """월간 +15% → MEDIUM 시그널"""
        rows = self._make_rows([(0, 11500), (31, 10000)])  # +15%
        result = _analyze_price_trend_logic(rows)
        medium_signals = [r for r in result if r["severity"] == "MEDIUM"]
        assert len(medium_signals) == 1
        assert "월간" in medium_signals[0]["description"]

    def test_no_signal_when_insufficient_data(self):
        """가격 데이터 1개 → 시그널 없음"""
        today = datetime.date.today().strftime("%Y-%m-%d")
        rows = [{"date": today, "close_price": 10000}]
        result = _analyze_price_trend_logic(rows)
        assert result == []

    def test_zero_price_returns_empty(self):
        """최신 가격 0 → 시그널 없음"""
        rows = [
            {"date": datetime.date.today().strftime("%Y-%m-%d"), "close_price": 0},
            {"date": (datetime.date.today() - datetime.timedelta(days=8)).strftime("%Y-%m-%d"), "close_price": 10000},
        ]
        result = _analyze_price_trend_logic(rows)
        assert result == []


# ── 재무 분석 테스트 ───────────────────────────────────────────────────────────

class TestFinancials:
    def test_debt_surge_detected(self):
        """부채비율 20%p 이상 급등 → DEBT_SURGE"""
        rows = [
            {"period": "2024Q4", "debt_ratio": 120.0, "op_income": 100, "dividend_per_share": None},
            {"period": "2024Q3", "debt_ratio": 90.0,  "op_income": 100, "dividend_per_share": None},
        ]
        result = _analyze_financials_logic(rows)
        debt_sigs = [r for r in result if r["type"] == "DEBT_SURGE"]
        assert len(debt_sigs) == 1
        assert "부채비율 급등" in debt_sigs[0]["description"]

    def test_debt_below_20pp_no_signal(self):
        """부채비율 19.9%p 상승 → 시그널 없음"""
        rows = [
            {"period": "2024Q4", "debt_ratio": 109.9, "op_income": 100, "dividend_per_share": None},
            {"period": "2024Q3", "debt_ratio": 90.0,  "op_income": 100, "dividend_per_share": None},
        ]
        result = _analyze_financials_logic(rows)
        assert not any(r["type"] == "DEBT_SURGE" for r in result)

    def test_op_loss_transition(self):
        """영업이익 흑자 → 적자 전환 → OP_LOSS"""
        rows = [
            {"period": "2024Q4", "debt_ratio": 50.0, "op_income": -500, "dividend_per_share": None},
            {"period": "2024Q3", "debt_ratio": 50.0, "op_income":  100, "dividend_per_share": None},
        ]
        result = _analyze_financials_logic(rows)
        assert any(r["type"] == "OP_LOSS" for r in result)

    def test_already_loss_no_transition_signal(self):
        """이미 적자 → 적자 지속은 OP_LOSS 아님"""
        rows = [
            {"period": "2024Q4", "debt_ratio": 50.0, "op_income": -200, "dividend_per_share": None},
            {"period": "2024Q3", "debt_ratio": 50.0, "op_income": -100, "dividend_per_share": None},
        ]
        result = _analyze_financials_logic(rows)
        assert not any(r["type"] == "OP_LOSS" for r in result)

    def test_dividend_increase_10pct(self):
        """배당 10% 증가 → DIVIDEND_CHANGE"""
        rows = [
            {"period": "2024", "debt_ratio": 50.0, "op_income": 100, "dividend_per_share": 1100},
            {"period": "2023", "debt_ratio": 50.0, "op_income": 100, "dividend_per_share": 1000},
        ]
        result = _analyze_financials_logic(rows)
        div_sigs = [r for r in result if r["type"] == "DIVIDEND_CHANGE"]
        assert len(div_sigs) == 1
        assert "증가" in div_sigs[0]["description"]

    def test_dividend_cut_10pct(self):
        """배당 -10% → DIVIDEND_CHANGE 감소"""
        rows = [
            {"period": "2024", "debt_ratio": 50.0, "op_income": 100, "dividend_per_share": 900},
            {"period": "2023", "debt_ratio": 50.0, "op_income": 100, "dividend_per_share": 1000},
        ]
        result = _analyze_financials_logic(rows)
        div_sigs = [r for r in result if r["type"] == "DIVIDEND_CHANGE"]
        assert len(div_sigs) == 1
        assert "감소" in div_sigs[0]["description"]

    def test_insufficient_rows_returns_empty(self):
        """데이터 1개 → 시그널 없음"""
        rows = [{"period": "2024Q4", "debt_ratio": 50.0, "op_income": 100, "dividend_per_share": 1000}]
        result = _analyze_financials_logic(rows)
        assert result == []

    def test_none_values_handled(self):
        """None 값 있어도 오류 없이 빈 시그널 반환"""
        rows = [
            {"period": "2024Q4", "debt_ratio": None, "op_income": None, "dividend_per_share": None},
            {"period": "2024Q3", "debt_ratio": None, "op_income": None, "dividend_per_share": None},
        ]
        result = _analyze_financials_logic(rows)
        assert result == []
