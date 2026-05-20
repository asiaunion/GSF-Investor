"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/wealth", label: "전체 자산" },
  { href: "/stocks", label: "관심종목" },
  { href: "/disclosures", label: "공시" },
  { href: "/signals", label: "시그널" },
  { href: "/journal", label: "매매 일지" },
  { href: "/reports", label: "AI 보고서" },
  { href: "/discover", label: "종목 발굴" },
  { href: "/settings", label: "설정" },
];

interface NavbarProps {
  email?: string | null;
}

export default function Navbar({ email }: NavbarProps) {
  const pathname = usePathname();
  const [unresolvedCount, setUnresolvedCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchBadge = async () => {
      try {
        const res = await fetch("/api/signals/badge");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setUnresolvedCount(data.unresolvedCount ?? 0);
      } catch {}
    };
    fetchBadge();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  return (
    <nav className="border-b border-border-default bg-bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="group flex items-center gap-2.5 shrink-0"
            aria-label="GSF Investor 홈"
          >
            <span className="relative flex h-9 w-9 items-center justify-center border-2 border-brand-green bg-bg-base shadow-sm transition-colors group-hover:bg-brand-green/10">
              <span className="font-serif text-xl font-bold leading-none text-brand-green -mt-px">
                G
              </span>
              <span className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-brand-green/40 group-hover:bg-brand-green transition-colors" />
            </span>
            <span className="hidden sm:block font-serif font-semibold text-text-primary text-sm tracking-tight">
              GSF Investor
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto min-w-0 flex-1 justify-center px-2">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            const isSignals = link.href === "/signals";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative shrink-0 px-2.5 py-1.5 rounded-sm text-xs transition-colors ${
                  isActive
                    ? "font-bold text-brand-green bg-brand-green/10 border border-brand-green/25"
                    : "font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }`}
              >
                {link.label}
                {isSignals && unresolvedCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-loss-500 text-text-primary text-[10px] font-bold flex items-center justify-center">
                    {unresolvedCount > 9 ? "9+" : unresolvedCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {email && (
            <span className="text-xs text-text-muted hidden lg:block max-w-[140px] truncate">
              {email}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
