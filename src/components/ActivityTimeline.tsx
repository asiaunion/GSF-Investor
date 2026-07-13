import Link from "next/link";
import StockIdentity from "@/components/StockIdentity";
import { swsCard } from "@/lib/economist-ui";

export type ActivityItem = {
  kind: "trade" | "disclosure";
  at: string;
  ticker: string;
  stockName: string;
  title: string;
  detail?: string;
  href?: string;
};

const KIND_ICON: Record<ActivityItem["kind"], string> = {
  trade: "📒",
  disclosure: "📄",
};

export default function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <div className={`${swsCard} overflow-hidden`}>
      <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">최근 활동</h2>
        <Link href="/journal" className="text-xs text-brand-green hover:underline">
          일지 →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-text-muted">최근 매매·공시 없음</p>
      ) : (
        <ul className="divide-y divide-border-default/50">
          {items.map((item, i) => {
            const inner = (
              <div className="px-4 py-2.5 flex gap-3 text-sm hover:bg-bg-elevated/25 transition-colors">
                <span className="text-base shrink-0" aria-hidden>
                  {KIND_ICON[item.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <StockIdentity
                      name={item.stockName}
                      ticker={item.ticker}
                      size="sm"
                      className="flex-1"
                    />
                    <span className="text-xs text-text-disabled shrink-0">{item.at.slice(0, 10)}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.title}</p>
                  {item.detail && (
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{item.detail}</p>
                  )}
                </div>
              </div>
            );
            return (
              <li key={`${item.kind}-${item.at}-${i}`}>
                {item.href ? (
                  <Link href={item.href} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
