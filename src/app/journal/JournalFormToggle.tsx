"use client";

import { useState, useEffect } from "react";
import JournalForm from "./JournalForm";
import { btnNeutral, btnPrimary, swsCard } from "@/lib/economist-ui";

/**
 * C-4: 모바일 Bottom Sheet + 데스크탑 인라인 패널 반응형 폼 토글
 */
export default function JournalFormToggle() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isMobile]);

  const handleClose = () => setOpen(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full sm:w-auto text-xs px-4 py-2 rounded-sm font-semibold transition-colors ${
          open && !isMobile ? btnNeutral : btnPrimary
        }`}
      >
        {open && !isMobile ? "✕ 닫기" : "+ 새 거래 기록"}
      </button>

      {open && !isMobile && (
        <div className={`mt-4 ${swsCard} overflow-hidden`}>
          <div className="px-6 py-4 border-b border-border-default">
            <h2 className="text-base font-semibold text-text-primary">새 매매 일지</h2>
            <p className="text-xs text-text-muted mt-0.5">거래 내역을 기록하세요</p>
          </div>
          <div className="px-6 py-5">
            <JournalForm onSuccess={handleClose} />
          </div>
        </div>
      )}

      {isMobile && (
        <>
          <div
            className={`fixed inset-0 z-40 transition-opacity duration-300 ${
              open
                ? "bg-black/70 backdrop-blur-sm pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={handleClose}
            aria-hidden="true"
          />

          <div
            className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
              open ? "translate-y-0" : "translate-y-full"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="새 매매 일지"
          >
            <div className="bg-bg-surface border-t-4 border-t-brand-green border border-border-default rounded-t-sm shadow-sm max-h-[90vh] flex flex-col">
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-border-strong rounded-full" />
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-b border-border-default shrink-0">
                <h2 className="text-base font-semibold text-text-primary">새 매매 일지</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className={`text-xs px-3 py-1.5 rounded-sm transition-colors ${btnNeutral}`}
                  aria-label="닫기"
                >
                  ✕ 닫기
                </button>
              </div>

              <div className="overflow-y-auto overscroll-contain px-5 py-4 flex-1">
                <JournalForm onSuccess={handleClose} />
                <div className="h-8" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
