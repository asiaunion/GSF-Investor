"use client";

import { useState } from "react";
import JournalForm from "./JournalForm";

export default function JournalFormToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full sm:w-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          open
            ? "bg-zinc-700 text-zinc-300 border border-zinc-600"
            : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500"
        }`}
      >
        {open ? (
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

      {open && (
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-5">새 매매 일지</h2>
          <JournalForm onSuccess={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
