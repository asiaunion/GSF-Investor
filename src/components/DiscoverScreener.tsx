"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  btnNeutral,
  btnPrimary,
  swsCard,
  inputClass,
  marketBadge,
} from "@/lib/economist-ui";
import { EconomistAlert } from "@/components/EconomistPage";
import StockIdentity from "@/components/StockIdentity";

type ScreenStock = {
  stockId: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  sector: string;
  latestPrice: number | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  operatingMargin: number | null;
  dividendYield: number | null;
  isHeld: boolean;
  finPeriod: string | null;
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
  return1y: number | null;
  pctFrom52wHigh: number | null;
  revenueYoY: number | null;
  epsYoY: number | null;
};

type SortKey =
  | "name"
  | "per"
  | "pbr"
  | "roe"
  | "dividendYield"
  | "return1m"
  | "return1y"
  | "pctFrom52wHigh"
  | "revenueYoY";

function ScreenerSortTh({
  label,
  col,
  sortKey,
  sortAsc,
  onToggle,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onToggle: (key: SortKey) => void;
}) {
  return (
    <th
      className="text-right px-2 py-1 font-medium text-text-muted cursor-pointer select-none"
      onClick={() => onToggle(col)}
    >
      {label}
      {sortKey === col && (sortAsc ? " ↑" : " ↓")}
    </th>
  );
}

export default function DiscoverScreener() {
  const router = useRouter();
  const [market, setMarket] = useState<"ALL" | "KR" | "US">("ALL");
  const [held, setHeld] = useState<"all" | "only" | "exclude">("all");
  const [perMax, setPerMax] = useState("");
  const [pbrMax, setPbrMax] = useState("");
  const [roeMin, setRoeMin] = useState("");
  const [return1mMin, setReturn1mMin] = useState("");
  const [pct52wMin, setPct52wMin] = useState("");
  const [revenueYoYMin, setRevenueYoYMin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stocks, setStocks] = useState<ScreenStock[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const runScreen = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ market, held });
    if (perMax.trim()) params.set("perMax", perMax.trim());
    if (pbrMax.trim()) params.set("pbrMax", pbrMax.trim());
    if (roeMin.trim()) params.set("roeMin", roeMin.trim());
    if (return1mMin.trim()) params.set("return1mMin", return1mMin.trim());
    if (pct52wMin.trim()) params.set("pct52wMin", pct52wMin.trim());
    if (revenueYoYMin.trim()) params.set("revenueYoYMin", revenueYoYMin.trim());
    try {
      const res = await fetch(`/api/discover/screen?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setStocks(data.stocks ?? []);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "스크리너 실패");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [market, held, perMax, pbrMax, roeMin, return1mMin, pct52wMin, revenueYoYMin]);

  const toggleSelect = (ticker: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else if (next.size < 5) next.add(ticker);
      return next;
    });
  };

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (sortKey === "name") {
      const cmp = a.name.localeCompare(b.name, "ko");
      return sortAsc ? cmp : -cmp;
    }
    const an = av == null ? -Infinity : Number(av);
    const bn = bv == null ? -Infinity : Number(bv);
    return sortAsc ? an - bn : bn - an;
  });

  const goCompare = () => {
    if (selected.size < 2) return;
    router.push(`/discover?compare=${Array.from(selected).join(",")}`);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${swsCard} p-4 space-y-3`}>
        <p className="text-xs text-text-muted">
          <strong className="text-text-secondary">등록 관심종목</strong> 중 PER/PBR · 1M/1Y · 52주 · 매출 YoY 필터
          (KRX 전체가 아님 — 설정 → 신규 종목 추가 후 스크리닝) · 최대 5종목 비교
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs text-text-muted">
            시장
            <select
              className={`${inputClass} mt-1`}
              value={market}
              onChange={(e) => setMarket(e.target.value as typeof market)}
            >
              <option value="ALL">전체</option>
              <option value="KR">KR</option>
              <option value="US">US</option>
            </select>
          </label>
          <label className="text-xs text-text-muted">
            보유
            <select
              className={`${inputClass} mt-1`}
              value={held}
              onChange={(e) => setHeld(e.target.value as typeof held)}
            >
              <option value="all">전체</option>
              <option value="only">보유만</option>
              <option value="exclude">미보유</option>
            </select>
          </label>
          <label className="text-xs text-text-muted">
            PER ≤
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: 15"
              value={perMax}
              onChange={(e) => setPerMax(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted">
            PBR ≤
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: 1.5"
              value={pbrMax}
              onChange={(e) => setPbrMax(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted">
            ROE ≥ (%)
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: 10"
              value={roeMin}
              onChange={(e) => setRoeMin(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted">
            1M 수익 ≥ (%)
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: 5"
              value={return1mMin}
              onChange={(e) => setReturn1mMin(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted">
            52주고점 대비 ≥ (%)
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: -20"
              value={pct52wMin}
              onChange={(e) => setPct52wMin(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted sm:col-span-2">
            매출 YoY ≥ (%)
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: 0"
              value={revenueYoYMin}
              onChange={(e) => setRevenueYoYMin(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={runScreen} disabled={loading} className={btnPrimary}>
            {loading ? "검색 중…" : "스크리닝"}
          </button>
          <button
            type="button"
            onClick={goCompare}
            disabled={selected.size < 2}
            className={btnNeutral}
            title="2~5종목 선택"
          >
            비교 ({selected.size}/5)
          </button>
        </div>
      </div>

      {error && <EconomistAlert variant="error">{error}</EconomistAlert>}

      <div className={`${swsCard} overflow-hidden`}>
        <div className="px-4 py-2 border-b border-border-default flex justify-between items-center">
          <span className="text-sm font-semibold text-text-primary">
            결과 {stocks.length}건
          </span>
        </div>
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted text-center">
            조건을 설정하고 스크리닝을 실행하세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-bg-elevated/40">
                  <th className="w-8 px-2 py-1" />
                  <th
                    className="text-left px-2 py-1 font-medium text-text-muted cursor-pointer"
                    onClick={() => toggleSort("name")}
                  >
                    종목
                  </th>
                  <ScreenerSortTh label="PER" col="per" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="PBR" col="pbr" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="ROE" col="roe" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="배당%" col="dividendYield" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="1M%" col="return1m" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="1Y%" col="return1y" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="52주%" col="pctFrom52wHigh" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                  <ScreenerSortTh label="매출YoY" col="revenueYoY" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr
                    key={s.ticker}
                    className="border-b border-border-default/50 hover:bg-bg-elevated/30"
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.has(s.ticker)}
                        onChange={() => toggleSelect(s.ticker)}
                        disabled={!selected.has(s.ticker) && selected.size >= 5}
                        className="accent-brand-green"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <StockIdentity
                        name={s.name}
                        ticker={s.ticker}
                        href={`/stocks/${s.ticker}`}
                        size="sm"
                        trailing={
                          <>
                            <span className={`text-[10px] px-1 py-0.5 rounded ${marketBadge[s.market] ?? ""}`}>
                              {s.market}
                            </span>
                            {s.isHeld && (
                              <span className="text-[10px] text-brand-green">보유</span>
                            )}
                          </>
                        }
                      />
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.per ?? "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.pbr ?? "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.roe != null ? `${s.roe}%` : "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.dividendYield != null ? `${s.dividendYield}%` : "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.return1m != null ? `${s.return1m}%` : "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.return1y != null ? `${s.return1y}%` : "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.pctFrom52wHigh != null ? `${s.pctFrom52wHigh}%` : "—"}
                    </td>
                    <td className="text-right px-2 py-1.5 tabular-nums text-text-secondary">
                      {s.revenueYoY != null ? `${s.revenueYoY}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
