"use client";

import Link from "next/link";
import StockIdentity from "@/components/StockIdentity";
import { emotionBadge, tradeActionBadge } from "@/lib/economist-ui";

type JournalRow = {
  id: number;
  stockId: number | null;
  ticker: string | null;
  name: string | null;
  market: string | null;
  tradedAt: string;
  action: string;
  quantity: number;
  price: number;
  currency: string | null;
  thesis: string;
  emotionTag: string | null;
  createdAt: string | null;
};

export default function JournalList({ rows }: { rows: JournalRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-text-secondary font-medium text-sm">아직 매매 일지가 없습니다</p>
        <p className="text-text-muted text-xs mt-1 max-w-md mx-auto leading-relaxed">
          Portfolio 통합 후 주식 포지션은 여기서 <strong>INIT</strong>으로 다시 입력합니다. 위
          「거래 추가」에서 종목·증권사·수량·평균단가를 넣으면 대시보드·순자산에 반영됩니다.
        </p>
        <Link href="/settings" className="text-xs text-brand-green hover:underline mt-3 inline-block">
          관심 종목 확인 →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* 데스크탑 테이블 */}
      <table className="w-full text-sm hidden sm:table">
        <thead>
          <tr className="border-b border-border-default">
            {["날짜", "종목", "구분", "수량", "단가", "거래금액", "감정", ""].map((h) => (
              <th key={h} className="text-left text-xs text-text-muted font-medium pb-3 pr-4 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default/60">
          {rows.map((row) => {
            const total = (row.quantity * row.price).toLocaleString("ko-KR");
            return (
              <tr key={row.id} className="group hover:bg-bg-elevated/30 transition-colors">
                <td className="py-3 pr-4 text-text-secondary whitespace-nowrap">{row.tradedAt}</td>
                <td className="py-3 pr-4">
                  <StockIdentity
                    name={row.name ?? row.ticker ?? "—"}
                    ticker={row.ticker ?? ""}
                    href={row.ticker ? `/stocks/${row.ticker}` : undefined}
                    size="sm"
                  />
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${tradeActionBadge[row.action] ?? "text-text-secondary bg-bg-elevated border border-border-default"}`}>
                    {row.action}
                  </span>
                </td>
                <td className="py-3 pr-4 text-text-secondary tabular-nums">
                  {row.quantity.toLocaleString("ko-KR")}
                </td>
                <td className="py-3 pr-4 text-text-secondary tabular-nums">
                  ₩{row.price.toLocaleString("ko-KR")}
                </td>
                <td className="py-3 pr-4 text-text-primary font-medium tabular-nums">
                  ₩{total}
                </td>
                <td className="py-3 pr-4">
                  {row.emotionTag && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${emotionBadge[row.emotionTag] ?? "text-text-secondary bg-bg-elevated/30"}`}>
                      {row.emotionTag}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/journal/${row.id}`}
                    className="text-xs text-text-muted hover:text-brand-green transition-colors"
                  >
                    상세 →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 모바일 카드 */}
      <div className="sm:hidden space-y-3">
        {rows.map((row) => {
          const total = (row.quantity * row.price).toLocaleString("ko-KR");
          return (
            <Link key={row.id} href={`/journal/${row.id}`}>
              <div className="bg-bg-elevated/40 border border-border-default/50 rounded-sm p-4 hover:border-zinc-600 transition-colors">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <StockIdentity
                      name={row.name ?? row.ticker ?? "—"}
                      ticker={row.ticker ?? ""}
                      size="sm"
                    />
                    <span className="text-text-muted text-xs mt-1 block">{row.tradedAt}</span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${tradeActionBadge[row.action] ?? "text-text-secondary bg-bg-elevated border border-border-default"}`}>
                    {row.action}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-xs">
                    {row.quantity.toLocaleString()}주 × ₩{row.price.toLocaleString()}
                  </span>
                  <span className="text-text-primary font-semibold text-sm">₩{total}</span>
                </div>
                {row.emotionTag && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${emotionBadge[row.emotionTag] ?? "text-text-secondary bg-bg-elevated/30"}`}>
                      {row.emotionTag}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
