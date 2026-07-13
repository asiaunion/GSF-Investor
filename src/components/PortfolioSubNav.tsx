"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portfolio/overview", label: "Overview" },
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/returns", label: "Returns" },
  { href: "/portfolio/dividends", label: "Dividends" },
  { href: "/portfolio/analysis", label: "Analysis" },
];

export default function PortfolioSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-border-default bg-bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
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
        </nav>
      </div>
    </div>
  );
}
