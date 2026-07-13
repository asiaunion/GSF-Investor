"use client";

import { useState } from "react";
import { tabActive, tabInactive } from "@/lib/economist-ui";
import SignalsClient from "@/app/signals/SignalsClient";
import DisclosuresClient from "@/app/disclosures/DisclosuresClient";
import type { SignalRow } from "@/app/signals/SignalsClient";
import type { DisclosureRow } from "@/app/disclosures/DisclosuresClient";

type Tab = "signals" | "disclosures";

export default function UpdatesClient({
  signals,
  disclosures,
}: {
  signals: SignalRow[];
  disclosures: DisclosureRow[];
}) {
  const [tab, setTab] = useState<Tab>("signals");

  const tickers = Array.from(new Set(disclosures.map((d) => d.ticker))).sort();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border-default pb-0">
        {(["signals", "disclosures"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-t text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-brand-green font-semibold text-brand-green"
                : "border-transparent font-medium text-text-muted hover:text-text-secondary"
            }`}
          >
            {t === "signals" ? `시그널 (${signals.filter(s => !s.isResolved).length})` : `공시 (${disclosures.length})`}
          </button>
        ))}
      </div>
      {tab === "signals" && <SignalsClient signals={signals} />}
      {tab === "disclosures" && <DisclosuresClient disclosures={disclosures} tickers={tickers} />}
    </div>
  );
}
