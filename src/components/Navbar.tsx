"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/portfolio", label: "Portfolio" },
  { href: "/research", label: "Research" },
];

interface NavbarProps {
  email?: string | null;
}

export default function Navbar({ email }: NavbarProps) {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState<number>(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const fetchBadge = async () => {
      try {
        const res = await fetch("/api/signals/badge");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setAlertCount(data.unresolvedCount ?? 0);
      } catch {}
    };
    fetchBadge();
    return () => { mounted = false; };
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav className="border-b border-border-default bg-bg-surface/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/portfolio"
          className="group flex items-center gap-2.5 shrink-0"
          aria-label="GSF Investor 홈"
        >
          <span className="relative flex h-9 w-9 items-center justify-center border-2 border-brand-green bg-bg-base transition-colors group-hover:bg-brand-green/10">
            <span className="font-serif text-xl font-bold leading-none text-brand-green -mt-px">G</span>
            <span className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-brand-green/40 group-hover:bg-brand-green transition-colors" />
          </span>
          <span className="hidden sm:block font-serif font-semibold text-text-primary text-sm tracking-tight">
            GSF Investor
          </span>
        </Link>

        {/* Primary Nav */}
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            const isResearch = link.href === "/research";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3.5 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-brand-green bg-brand-green/12 border border-brand-green/25"
                    : "font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                }`}
              >
                {link.label}
                {isResearch && alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-loss-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right: ThemeToggle + Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-bg-elevated border border-border-strong hover:border-brand-green/40 transition-colors"
              aria-label="프로필 메뉴"
            >
              <span className="text-xs font-bold text-text-secondary">
                {email ? email[0].toUpperCase() : "U"}
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-10 w-52 bg-bg-surface border border-border-default rounded-lg shadow-md py-1 z-50">
                {email && (
                  <div className="px-3 py-2 border-b border-border-default">
                    <p className="text-xs text-text-muted truncate">{email}</p>
                  </div>
                )}
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                >
                  <span>설정</span>
                </Link>
                <button
                  onClick={() => { setProfileOpen(false); signOut(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-loss-400 hover:bg-loss-bg transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
