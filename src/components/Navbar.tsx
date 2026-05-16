"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "대시보드" },
  { href: "/stocks", label: "관심종목" },
  { href: "/disclosures", label: "공시" },
  { href: "/signals", label: "시그널" },
  { href: "/journal", label: "매매 일지" },
];

interface NavbarProps {
  email?: string | null;
}

export default function Navbar({ email }: NavbarProps) {
  const pathname = usePathname();
  const [unresolvedCount, setUnresolvedCount] = useState<number>(0);

  // 미확인 HIGH 시그널 배지 카운트 (클라이언트 폴링)
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
    return () => { mounted = false; };
  }, [pathname]); // pathname 변경 시 재조회

  return (
    <nav className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">GSF Investor</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-3 overflow-x-auto">
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
                className={`relative shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {link.label}
                {/* 시그널 배지 */}
                {isSignals && unresolvedCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unresolvedCount > 9 ? "9+" : unresolvedCount}
                  </span>
                )}
              </Link>
            );
          })}
          {email && (
            <span className="text-xs text-zinc-600 hidden sm:block ml-2 shrink-0">
              {email}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
