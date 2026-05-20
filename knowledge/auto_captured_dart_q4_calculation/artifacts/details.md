# DART 4분기 실적(Q4) 합성 로직 규명

## 1. 개요
DART 오픈 API(`fnlttSinglAcntAll`)를 통해 상장사의 재무 데이터를 수집할 때, 4분기(Q4) 단일 실적을 정확히 도출하는 방법에 대한 메타인지 기록입니다.

## 2. 문제 상황
* 기존에는 DART에 4분기 단일 보고서가 별도로 없으므로, **'연간 실적(FY) - 3분기 누적 실적(YTD)'**으로 4분기 실적을 합성하려 하였습니다.
* 그러나 DB에 수집된 3분기 실적이 **누적 실적(YTD)**이 아닌 **3개월 단일 실적**으로 적재되어 있었습니다.
* 이로 인해 `연간 실적(12개월) - 3분기 단일 실적(3개월)` 이라는 잘못된 수식이 적용되어, 4분기 실적에 무려 9개월치의 데이터가 뭉뚱그려져 실적이 과대 계상되는 버그가 발생했습니다.

## 3. 원인 분석 (DART API 특성)
DART API `fnlttSinglAcntAll` 엔드포인트는 포괄손익계산서(IS/CIS) 항목에 대해 두 가지 필드를 반환합니다.
* `thstrm_amount` (당기): **해당 분기 3개월(단일 분기) 실적**
* `thstrm_add_amount` (당기 누적): **해당 연도의 누적(YTD) 실적**

데이터 수집 파이프라인(`seed_financials_only.py`)에서는 다음과 같이 값을 파싱하고 있었습니다.
```python
val = acc.get("thstrm_amount", "") or acc.get("thstrm_add_amount", "")
```
`thstrm_amount`가 항상 우선적으로 채택되었기 때문에, Q1, Q2, Q3 모두 순수하게 **'해당 분기 3개월 치 단일 실적'**으로 DB에 저장되고 있었습니다.

## 4. 해결책 및 올바른 공식
DB에 Q1, Q2, Q3 실적이 순수 3개월 치로 정상 보관되고 있으므로, 4분기(Q4) 단일 실적은 다음과 같은 공식으로 구해야 합니다.

```text
Q4 = 연간 실적(FY) - (Q1 3개월 실적 + Q2 3개월 실적 + Q3 3개월 실적)
```

### 파이프라인 수정 반영 내역 (`seed_financials_only.py`)
```python
# 기존의 잘못된 수식 (FY - Q3)
# safe_sub(fy['revenue'], q3['revenue'])

# 올바른 수식 (FY - Q1 - Q2 - Q3)
def safe_sub(f_val, q3_val, q2_val, q1_val):
    if f_val is not None and q3_val is not None and q2_val is not None and q1_val is not None:
        return float(f_val) - float(q3_val) - float(q2_val) - float(q1_val)
    return None

safe_sub(fy['revenue'], q3['revenue'], q2['revenue'], q1['revenue'])
```

## 5. 핵심 교훈 (Takeaways)
* DART API에서 반기/분기 포괄손익계산서의 `thstrm_amount`는 누적이 아닌 '당기 3개월' 실적임을 유의해야 합니다.
* 누적(YTD) 실적이 필요한 경우 반드시 `thstrm_add_amount`를 명시적으로 참조해야 합니다.
* 4분기 데이터를 합성할 때는, 기저에 깔린 1~3분기 데이터가 누적(YTD)인지 단일 분기인지 데이터 정합성을 먼저 확인하고 수식을 세워야 합니다.
