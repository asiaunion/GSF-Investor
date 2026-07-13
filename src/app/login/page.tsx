"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { DEV_PREVIEW_PROVIDER_ID } from "@/lib/dev-preview";
import { swsCard } from "@/lib/economist-ui";

const showDevPreview = process.env.NEXT_PUBLIC_DEV_PREVIEW_AUTH === "true";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [loading, setLoading] = useState<"google" | "preview" | null>(null);

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <Link
              href="/"
              className="inline-flex flex-col items-center gap-3 group"
              aria-label="GSF Investor 홈"
            >
              <span className="relative flex h-14 w-14 items-center justify-center border-2 border-brand-green bg-bg-surface shadow-sm transition-colors group-hover:bg-brand-green/10">
                <span className="font-serif text-3xl font-bold leading-none text-brand-green">
                  G
                </span>
                <span className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-brand-green/40 group-hover:bg-brand-green transition-colors" />
              </span>
              <span className="font-serif text-2xl font-bold text-text-primary tracking-tight">
                GSF Investor
              </span>
            </Link>
            <p className="text-text-secondary text-sm mt-2">개인 투자 시스템</p>
          </div>

          <div className={`${swsCard} p-8`}>
            <h2 className="text-lg font-semibold text-text-primary mb-1">로그인</h2>
            <p className="text-text-muted text-sm mb-6">
              Google 계정으로 안전하게 접속하세요.
            </p>

            <button
              type="button"
              disabled={loading !== null}
              onClick={() => {
                setLoading("google");
                signIn("google", { callbackUrl });
              }}
              className="w-full flex items-center justify-center gap-3 bg-bg-elevated hover:bg-bg-surface border border-border-default text-text-primary font-medium py-3 px-4 rounded-sm transition-colors disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google로 계속하기
            </button>

            {showDevPreview && (
              <>
                <div className="my-5 border-t border-border-default relative">
                  <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-bg-surface px-2 text-[10px] text-text-muted uppercase tracking-wider">
                    로컬 검증
                  </span>
                </div>
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => {
                    setLoading("preview");
                    signIn(DEV_PREVIEW_PROVIDER_ID, {
                      token: process.env.NEXT_PUBLIC_DEV_PREVIEW_SECRET || "preview",
                      callbackUrl,
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 border-2 border-brand-green bg-brand-green/10 hover:bg-brand-green/15 text-brand-green font-bold py-3 px-4 rounded-sm transition-colors disabled:opacity-60"
                >
                  디자인 프리뷰 (로그인 없이)
                </button>
                <p className="text-center text-[11px] text-text-muted mt-3">
                  개발 전용 · 데모 DB · Turso 불필요
                </p>
              </>
            )}

            <p className="text-center text-xs text-text-muted mt-5">
              승인된 계정만 접근 가능합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
