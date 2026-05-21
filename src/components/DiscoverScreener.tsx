"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  btnNeutral,
  btnPrimary,
  economistCard,
  inputClass,
  linkMuted,
  marketBadge,
} from "@/lib/economist-ui";
import { EconomistAlert } from "@/components/EconomistPage";

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
};

type SortKey = "name" | "per" | "pbr" | "roe" | "dividendYield";

export default function DiscoverScreener() {
  const router = useRouter();
  const [market, setMarket] = useState<"ALL" | "KR" | "US">("ALL");
  const [held, setHeld] = useState<"all" | "only" | "exclude">("all");
  const [perMax, setPerMax] = useState("");
  const [pbrMax, setPbrMax] = useState("");
  const [roeMin, setRoeMin] = useState("");
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
  }, [market, held, perMax, pbrMax, roeMin]);

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

  const SortTh = ({ label, col }: { label: string; col: SortKey }) => (
    <th className="text-right px-2 py-1 font-medium text-text-muted cursor-pointer select-none" onClick={() => toggleSort(col)}>
      {label}
      {sortKey === col && (sortAsc ? " ↑" : " ↓")}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className={`${economistCard} p-4 space-y-3`}>
        <p className="text-xs text-text-muted">FY 기준 PER/PBR · 보유 필터 · 최대 5종목 비교</p>
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
          <label className="text-xs text-text-muted sm:col-span-2">
            ROE ≥ (%)
            <input
              className={`${inputClass} mt-1 tabular-nums`}
              placeholder="예: 10"
              value={roeMin}
              onChange={(e) => setRoeMin(e.target.value)}
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

      <div className={`${economistCard} overflow-hidden`}>
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
                  <SortTh label="PER" col="per" />
                  <SortTh label="PBR" col="pbr" />
                  <SortTh label="ROE" col="roe" />
                  <SortTh label="배당%" col="dividendYield" />
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
                      <Link href={`/stocks/${s.ticker}`} className={linkMuted}>
                        <span className="font-medium text-text-primary">{s.name}</span>
                        <span className="text-text-muted ml-1 text-xs">{s.ticker}</span>
                      </Link>
                      <span className={`ml-1 text-[10px] ${marketBadge[s.market] ?? ""}`}>
                        {s.market}
                      </span>
                      {s.isHeld && (
                        <span className="ml-1 text-[10px] text-brand-green">보유</span>
                      )}
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
