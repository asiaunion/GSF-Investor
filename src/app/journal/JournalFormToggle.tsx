"use client";

import { useState, useEffect } from "react";
import JournalForm from "./JournalForm";

/**
 * C-4: 모바일 Bottom Sheet + 데스크탑 인라인 패널 반응형 폼 토글
 *
 * - 모바일(< 640px): 화면 하단에서 슬라이드업 Bottom Sheet
 * - 데스크탑(>= 640px): 기존 인라인 패널 방식
 *
 * Bottom Sheet 특징:
 * - 배경 오버레이(backdrop) 탭으로 닫기
 * - 상단 드래그 핸들 표시
 * - 최대 높이 90vh + 스크롤 가능
 * - 애니메이션: translate-y 트랜지션 (GPU 가속)
 */
export default function JournalFormToggle() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 화면 너비 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Bottom Sheet 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  const handleClose = () => setOpen(false);

  return (
    <div>
      {/* ── 열기 버튼 ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          open && !isMobile
            ? "bg-zinc-700 text-zinc-300 border border-zinc-600"
            : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500"
        }`}
      >
        {open && !isMobile ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            취소
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            새 거래 기록
          </>
        )}
      </button>

      {/* ── 데스크탑: 인라인 패널 ── */}
      {open && !isMobile && (
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-5">새 매매 일지</h2>
          <JournalForm onSuccess={handleClose} />
        </div>
      )}

      {/* ── 모바일: Bottom Sheet ── */}
      {isMobile && (
        <>
          {/* 오버레이 */}
          <div
            className={`fixed inset-0 z-40 transition-opacity duration-300 ${
              open
                ? "bg-black/70 backdrop-blur-sm pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Bottom Sheet 패널 */}
          <div
            className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
              open ? "translate-y-0" : "translate-y-full"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="새 매매 일지"
          >
            <div className="bg-zinc-900 border-t border-zinc-700 rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
              {/* 드래그 핸들 */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-zinc-600 rounded-full" />
              </div>

              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
                <h2 className="text-base font-semibold text-white">새 매매 일지</h2>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                  aria-label="닫기"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* 폼 영역 (스크롤 가능) */}
              <div className="overflow-y-auto overscroll-contain px-5 py-4 flex-1">
                <JournalForm onSuccess={handleClose} />
                {/* 하단 여백 (iOS 홈바 영역 대응) */}
                <div className="h-8" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
