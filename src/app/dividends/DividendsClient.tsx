"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import StockIdentity from "@/components/StockIdentity";
import {
  economistCard,
  tabActive,
  tabInactive,
} from "@/lib/economist-ui";
import {
  formatMoney,
  type BaseCurrency,
  type FxRates,
} from "@/lib/format-money";

export type DividendRow = {
  id: number;
  ticker: string;
  stockName: string;
  exDate: string;
  payDate: string | null;
  amountPerShare: number;
  currency: string;
  source: string | null;
  isHeld: boolean;
  quantity: number;
};

type Tab = "upcoming" | "past" | "all";

type Props = {
  rows: DividendRow[];
  baseCurrency: BaseCurrency;
  fxRates: FxRates;
};

function todayKst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function formatAmount(row: DividendRow): string {
  const n = row.amountPerShare;
  if (row.currency === "KRW") {
    return new Intl.NumberFormat("ko-KR").format(n) + "원/주";
  }
  if (row.currency === "USD") {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n) +
      "/주"
    );
  }
  if (row.currency === "JPY") {
    return new Intl.NumberFormat("ja-JP").format(n) + "円/주";
  }
  return `${n} ${row.currency}/주`;
}

function estimateKrw(row: DividendRow, fx: FxRates): number | null {
  if (!row.isHeld || row.quantity <= 0) return null;
  const gross = row.amountPerShare * row.quantity;
  if (row.currency === "KRW") return gross;
  if (row.currency === "USD" && fx.usdKrw > 0) return gross * fx.usdKrw;
  if (row.currency === "JPY" && fx.jpyKrw && fx.jpyKrw > 0) return gross * fx.jpyKrw;
  return null;
}

export default function DividendsClient({ rows, baseCurrency, fxRates }: Props) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [heldOnly, setHeldOnly] = useState(false);
  const today = todayKst();

  const filtered = useMemo(() => {
    let list = rows;
    if (heldOnly) list = list.filter((r) => r.isHeld);
    if (tab === "upcoming") list = list.filter((r) => r.exDate >= today);
    else if (tab === "past") list = list.filter((r) => r.exDate < today);
    return [...list].sort((a, b) =>
      tab === "past" ? b.exDate.localeCompare(a.exDate) : a.exDate.localeCompare(b.exDate)
    );
  }, [rows, tab, heldOnly, today]);

  const heldUpcoming = useMemo(
    () =>
      rows.filter((r) => r.isHeld && r.exDate >= today).length,
    [rows, today]
  );

  const yearEst = useMemo(() => {
    const y = today.slice(0, 4);
    return rows
      .filter((r) => r.isHeld && r.exDate.startsWith(y))
      .reduce((sum, r) => sum + (estimateKrw(r, fxRates) ?? 0), 0);
  }, [rows, today, fxRates]);

  if (rows.length === 0) {
    return (
      <div className={`${economistCard} p-8 text-center max-w-lg mx-auto`}>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          배당 일정이 아직 없습니다. GitHub Actions{" "}
          <code className="text-brand-green/90">update_dividend_calendar</code> 워크플로를
          실행하거나 로컬에서{" "}
          <code className="text-brand-green/90">scripts/update_dividend_calendar.py</code>를
          돌려 주세요.
        </p>
        <p className="text-xs text-text-muted">
          데이터 출처: yfinance (배당락일). 지급일은 API 미제공으로 비워 둡니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={`${economistCard} p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm`}>
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide">전체 이벤트</p>
          <p className="text-xl font-bold text-text-primary mt-1">{rows.length}건</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">다가오는 배당락 (보유)</p>
          <p className="text-xl font-bold text-brand-green mt-1">{heldUpcoming}건</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">{today.slice(0, 4)}년 보유 추정 (KRW)</p>
          <p className="text-lg font-semibold text-text-primary mt-1">
            {yearEst > 0 ? formatMoney(yearEst, baseCurrency, fxRates) : "—"}
          </p>
          <p className="text-xs text-text-muted mt-1">주당×수량, 환율·통화 단순 환산</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-sm border border-border-default overflow-hidden">
          {(
            [
              ["upcoming", "예정"],
              ["past", "지난"],
              ["all", "전체"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`px-3 py-1.5 text-sm ${tab === id ? tabActive : tabInactive}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={heldOnly}
            onChange={(e) => setHeldOnly(e.target.checked)}
            className="accent-brand-green"
          />
          보유 종목만
        </label>
      </div>

      <div className={`${economistCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated/50 text-left text-xs text-text-muted uppercase tracking-wide">
                <th className="px-4 py-3">배당락</th>
                <th className="px-4 py-3">종목</th>
                <th className="px-4 py-3">주당</th>
                <th className="px-4 py-3">보유 추정</th>
                <th className="px-4 py-3">지급일</th>
                <th className="px-4 py-3">출처</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    조건에 맞는 일정이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const est = estimateKrw(r, fxRates);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border-default/60 hover:bg-bg-elevated/30"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                        {r.exDate}
                      </td>
                      <td className="px-4 py-3">
                        <StockIdentity
                          name={r.stockName}
                          ticker={r.ticker}
                          href={`/stocks/${r.ticker}`}
                          size="sm"
                          trailing={
                            r.isHeld ? (
                              <span className="text-[10px] text-brand-green">{r.quantity}주</span>
                            ) : undefined
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {formatAmount(r)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {est != null && est > 0 ? (
                          <span className="text-text-primary">
                            {formatMoney(est, baseCurrency, fxRates)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                        {r.payDate ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{r.source ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-text-muted text-center">
        yfinance 기준 · 지급일 미제공 · 매주 일요일 22:00(KST) cron 갱신
      </p>
    </div>
  );
}
