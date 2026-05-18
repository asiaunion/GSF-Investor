"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppPageLayout from "@/components/AppPageLayout";
import { economistCard, marketBadge, tabActive, tabInactive } from "@/lib/economist-ui";
import { useSession } from "next-auth/react";

interface StockItem {
  id: number;
  ticker: string;
  name: string;
  market: string;
  category: string;
  broker: string | null;
  thesis: string | null;
  currentPrice: number | null;
  priceDate: string | null;
  currency: string;
  quantity: number;
  avgPrice: number | null;
  holdingReturn: number | null;
  evalAmountKRW: number | null;
}

function ReturnBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted text-xs">—</span>;
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${
        positive
          ? "bg-profit-bg text-profit-400 border border-profit-border"
          : "bg-loss-bg text-loss-400 border border-loss-border"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function MarketBadge({ market }: { market: string }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${marketBadge[market] ?? marketBadge.US}`}>
      {market}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm border ${
        category === "Core"
          ? "bg-brand-green/10 text-brand-green border-brand-green/25"
          : "bg-brand-blue/10 text-brand-blue border-brand-blue/30"
      }`}
    >
      {category}
    </span>
  );
}

export default function StocksPage() {
  const { data: session } = useSession();
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [usdkrw, setUsdkrw] = useState<number>(1300);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "Core" | "Satellite">("ALL");

  useEffect(() => {
    fetch("/api/stocks")
      .then((r) => r.json())
      .then((data) => {
        setStocks(data.stocks ?? []);
        setUsdkrw(data.usdkrw ?? 1300);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "ALL" ? stocks : stocks.filter((s) => s.category === filter);
  const totalEval = stocks.reduce((sum, s) => sum + (s.evalAmountKRW ?? 0), 0);

  const filterTabs = (
    <div className="flex gap-1 bg-bg-surface rounded-sm p-1 border border-border-default shrink-0">
      {(["ALL", "Core", "Satellite"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFilter(f)}
          className={`px-3 py-1.5 rounded-sm text-xs transition-all ${filter === f ? tabActive : tabInactive}`}
        >
          {f}
        </button>
      ))}
    </div>
  );

  return (
    <AppPageLayout
      wide
      email={session?.user?.email}
      title="관심종목"
      subtitle={
        <>
          총 {stocks.length}개 종목 · 총 평가금액{" "}
          <span className="text-text-secondary font-medium">
            {totalEval > 0 ? `₩${(totalEval / 1_0000_0000).toFixed(2)}억` : "—"}
          </span>
        </>
      }
      headerExtra={filterTabs}
    >
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-48 ${economistCard} animate-pulse`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-sm bg-bg-surface border border-border-default flex items-center justify-center">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-text-muted">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
          </div>
          <p className="text-text-muted text-sm">종목이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((stock) => (
            <StockCard key={stock.id} stock={stock} usdkrw={usdkrw} />
          ))}
        </div>
      )}
    </AppPageLayout>
  );
}

function StockCard({ stock, usdkrw }: { stock: StockItem; usdkrw: number }) {
  const priceStr =
    stock.currentPrice != null
      ? stock.currency === "USD"
        ? `$${stock.currentPrice.toFixed(2)}`
        : `₩${stock.currentPrice.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`
      : "—";

  const isHolding = stock.quantity > 0;

  return (
    <Link href={`/stocks/${stock.ticker}`} className="group block">
      <div className={`${economistCard} p-5 h-full hover:border-brand-green/40 transition-all duration-200`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-text-primary font-semibold text-sm">{stock.name}</span>
              <MarketBadge market={stock.market} />
            </div>
            <span className="text-text-muted text-xs mt-0.5 block">{stock.ticker}</span>
          </div>
          <CategoryBadge category={stock.category} />
        </div>

        <div className="flex items-end justify-between mt-4">
          <div>
            <div className="text-text-primary text-xl font-bold tracking-tight">{priceStr}</div>
            {stock.currentPrice != null && stock.currency === "USD" && (
              <div className="text-text-muted text-xs mt-0.5">
                ≈ ₩{(stock.currentPrice * usdkrw).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
              </div>
            )}
            {stock.priceDate && (
              <div className="text-text-disabled text-[10px] mt-0.5">{stock.priceDate}</div>
            )}
          </div>
          <ReturnBadge value={stock.holdingReturn} />
        </div>

        {isHolding && (
          <div className="mt-3 pt-3 border-t border-border-default grid grid-cols-2 gap-2">
            <div>
              <div className="text-text-muted text-[10px] uppercase tracking-wider">수량</div>
              <div className="text-text-secondary text-xs font-medium mt-0.5">
                {stock.quantity.toLocaleString()}주
              </div>
            </div>
            <div>
              <div className="text-text-muted text-[10px] uppercase tracking-wider">평가금액</div>
              <div className="text-text-secondary text-xs font-medium mt-0.5">
                {stock.evalAmountKRW != null
                  ? `₩${(stock.evalAmountKRW / 1_000_000).toFixed(1)}M`
                  : "—"}
              </div>
            </div>
          </div>
        )}

        {stock.thesis && (
          <div className="mt-3 text-text-muted text-xs line-clamp-2 leading-relaxed">
            {stock.thesis}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            className="text-text-disabled group-hover:text-brand-green transition-colors"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
