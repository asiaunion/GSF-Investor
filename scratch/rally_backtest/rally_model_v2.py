#!/usr/bin/env python3
"""동서 매도 전략 모델링 v2 — 미래참조 없는(causal) 규칙만. 3개 랠리."""
import json
import pandas as pd
import numpy as np

rows = json.load(open('dongsuh_naver_daily.json'))
df = pd.DataFrame(rows[1:], columns=rows[0])
df['date'] = pd.to_datetime(df['날짜'], format='%Y%m%d')
df = df.set_index('date')[['종가']].rename(columns={'종가': 'close'}).astype(float)

w = df['close'].resample('W-FRI').last().dropna().to_frame('close')
w['ma20'] = w['close'].rolling(20).mean()
w['disp'] = w['close'] / w['ma20'] - 1
delta = w['close'].diff()
gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
loss = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
w['rsi'] = 100 - 100 / (1 + gain / loss)

RALLIES = [
    ('랠리1 2014-15 중국수출 기대', '2014-01-03', '2016-12-30'),
    ('랠리2 2020-21', '2020-01-03', '2022-12-30'),
    ('랠리3 2024 말', '2024-06-07', '2026-07-10'),
]

def run(label, s, e):
    win = w.loc[s:e]
    peak = win['close'].max(); peak_dt = win['close'].idxmax()
    end_price = win['close'].iloc[-1]
    # 피크 이후 최저점 (버티기 비용)
    trough_after = win.loc[peak_dt:]['close'].min()

    strategies = {}

    def simulate(rule):
        """rule(state, row) -> list of (fraction, price) 매도 체결. 잔량은 윈도우 종료가."""
        remaining = 1.0
        fills = []
        state = {}
        for dt, row in win.iterrows():
            if remaining <= 0: break
            for frac, price in rule(state, row):
                frac = min(frac, remaining)
                fills.append((frac, price))
                remaining -= frac
        if remaining > 0:
            fills.append((remaining, end_price))
        avg = sum(f * p for f, p in fills)
        return avg, fills

    # S1: 이격 T 도달 첫 주 전량
    def s1(T):
        def rule(st, r):
            if r['disp'] >= T: return [(1.0, r['close'])]
            return []
        return rule

    # S2: 사다리 20/25/30 — 각 임계 최초 도달 시 1/3
    def s2(st, r):
        out = []
        for i, T in enumerate((0.20, 0.25, 0.30)):
            if not st.get(i) and r['disp'] >= T:
                st[i] = True; out.append((1/3, r['close']))
        return out

    # S3: 이격20% 무장 후 20주선 종가 이탈 시 전량
    def s3(st, r):
        if not st.get('armed') and r['disp'] >= 0.20:
            st['armed'] = True
        if st.get('armed') and r['close'] < r['ma20']:
            return [(1.0, r['close'])]
        return []

    # S4: 하이브리드 — 이격20% 도달 시 1/3 즉시, 잔량은 20주선 이탈 시
    def s4(st, r):
        out = []
        if not st.get('armed') and r['disp'] >= 0.20:
            st['armed'] = True; out.append((1/3, r['close']))
        if st.get('armed') and r['close'] < r['ma20']:
            out.append((1.0, r['close']))  # 잔량 전부
        return out

    # S4b: 이격20% 1/3 + 이격30% 1/3 + 잔량 20주선 이탈
    def s4b(st, r):
        out = []
        if not st.get('t20') and r['disp'] >= 0.20:
            st['t20'] = True; out.append((1/3, r['close']))
        if not st.get('t30') and r['disp'] >= 0.30:
            st['t30'] = True; out.append((1/3, r['close']))
        if st.get('t20') and r['close'] < r['ma20']:
            out.append((1.0, r['close']))
        return out

    # S5: RSI70 + 이격20% 동시 → 1/3, 잔량 20주선 이탈
    def s5(st, r):
        out = []
        if not st.get('armed') and r['disp'] >= 0.20 and r['rsi'] >= 70:
            st['armed'] = True; out.append((1/3, r['close']))
        if st.get('armed') and r['close'] < r['ma20']:
            out.append((1.0, r['close']))
        return out

    strategies['S1 이격20% 전량'] = simulate(s1(0.20))
    strategies['S1 이격25% 전량'] = simulate(s1(0.25))
    strategies['S2 사다리 20/25/30 1/3씩'] = simulate(s2)
    strategies['S3 이격20%무장→20주선이탈 전량'] = simulate(s3)
    strategies['S4 이격20% 1/3 + 잔량 20주선이탈'] = simulate(s4)
    strategies['S4b 20%·30% 1/3씩 + 잔량 이탈'] = simulate(s4b)
    strategies['S5 이격20%∧RSI70 1/3 + 잔량 이탈'] = simulate(s5)

    print(f"\n{'='*72}\n{label} | 피크 {peak_dt.date()} {peak:,.0f} | 피크후 저점 {trough_after:,.0f} ({trough_after/peak-1:+.0%})")
    print(f"{'전략':<34}{'평균매도가':>10}{'피크대비':>9}{'체결':>4}")
    for name, (avg, fills) in strategies.items():
        detail = ' / '.join(f"{f:.0%}@{p:,.0f}" for f, p in fills)
        print(f"{name:<34}{avg:>10,.0f}{avg/peak:>9.1%}  {detail}")
    print(f"{'(계속 보유: 윈도우 종료가)':<34}{end_price:>10,.0f}{end_price/peak:>9.1%}")

for label, s, e in RALLIES:
    run(label, s, e)

# ══ v3 추가: 재무장(re-arm) 전략 ══
print("\n\n" + "#"*72 + "\n# 재무장 전략 — 이격이 5% 미만으로 식은 뒤 다시 20% 도달하면 새 이벤트\n" + "#"*72)

def run_rearm(label, s, e):
    win = w.loc[s:e]
    peak = win['close'].max(); peak_dt = win['close'].idxmax()
    end_price = win['close'].iloc[-1]
    results = {}

    def sim(rule, init_state=None):
        remaining, fills, st = 1.0, [], (init_state or {})
        for dt, r in win.iterrows():
            if remaining <= 1e-9: break
            for frac, price in rule(st, r, dt):
                frac = min(frac, remaining)
                if frac > 0: fills.append((dt, frac, price)); remaining -= frac
        if remaining > 1e-9: fills.append((win.index[-1], remaining, end_price))
        avg = sum(f*p for _, f, p in fills)
        return avg, fills

    # S6: 재무장 사다리 — 이벤트(이격 20% 신규 도달)마다 1/3 매도, 이격<5%로 식으면 재무장
    def s6(st, r, dt):
        out = []
        if st.get('armed', True) and r['disp'] >= 0.20:
            out.append((1/3, r['close'])); st['armed'] = False
        if not st.get('armed', True) and r['disp'] < 0.05:
            st['armed'] = True
        return out

    # S7: 재무장 하이브리드 — 이벤트마다 이격20%에서 1/4 + 그 파동의 20주선 이탈에서 1/4
    def s7(st, r, dt):
        out = []
        if st.get('armed', True) and r['disp'] >= 0.20:
            out.append((0.25, r['close'])); st['armed'] = False; st['wave'] = True
        if st.get('wave') and r['close'] < r['ma20']:
            out.append((0.25, r['close'])); st['wave'] = False
        if not st.get('armed', True) and r['disp'] < 0.05:
            st['armed'] = True
        return out

    # S8: 재무장 + 강도차등 — 이격20%에서 1/4, 같은 파동 이격30%에서 추가 1/4, 잔량은 계속 보유
    def s8(st, r, dt):
        out = []
        if st.get('armed', True) and r['disp'] >= 0.20:
            out.append((0.25, r['close'])); st['armed'] = False; st['hi'] = True
        if st.get('hi') and r['disp'] >= 0.30:
            out.append((0.25, r['close'])); st['hi'] = False
        if not st.get('armed', True) and r['disp'] < 0.05:
            st['armed'] = True; st['hi'] = False
        return out

    for name, rule in [('S6 재무장 사다리 (이벤트당 1/3)', s6),
                       ('S7 재무장 하이브리드 (20%에 1/4 + 이탈 1/4)', s7),
                       ('S8 재무장 강도차등 (20% 1/4 + 30% 1/4)', s8)]:
        avg, fills = sim(rule)
        detail = ' / '.join(f"{f:.0%}@{p:,.0f}({dt.strftime('%y-%m')})" for dt, f, p in fills)
        results[name] = (avg, detail)

    print(f"\n=== {label} | 피크 {peak_dt.date()} {peak:,.0f} ===")
    for name, (avg, detail) in results.items():
        print(f"  {name:<40} {avg:>8,.0f}  피크대비 {avg/peak:6.1%}")
        print(f"      체결: {detail}")
    print(f"  {'(계속 보유)':<40} {end_price:>8,.0f}  피크대비 {end_price/peak:6.1%}")

for label, s, e in RALLIES:
    run_rearm(label, s, e)
