"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/research/watchlist", label: "Watchlist" },
  { href: "/research/screening", label: "Screening" },
  { href: "/research/updates", label: "Updates" },
];

export default function ResearchSubNav() {
  const pathname = usePathname();
  const isDynamic = pathname.match(/^\/research\/[A-Z0-9]+/);

  return (
    <div className="border-b border-border-default bg-bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = !isDynamic && (pathname === tab.href || pathname.startsWith(tab.href + "/"));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 px-4 py-3 text-sm border-b-2 transition-colors ${
                  isActive
                    ? "border-brand-green font-semibold text-brand-green"
                    : "border-transparent font-medium text-text-muted hover:text-text-secondary hover:border-border-strong"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
          {isDynamic && (
            <span className="px-4 py-3 text-sm border-b-2 border-brand-green font-semibold text-brand-green">
              {pathname.split("/")[2]}
            </span>
          )}
        </nav>
      </div>
    </div>
  );
}
