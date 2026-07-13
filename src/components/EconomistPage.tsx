import type { ReactNode } from "react";
import {
  swsCard,
  swsStatCard,
  tabActive,
  tabInactive,
} from "@/lib/economist-ui";

/** 설정 탭과 동일한 KPI 카드 그리드 */
export function EconomistStatGrid({
  items,
}: {
  items: { label: string; value: ReactNode; valueClassName?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className={swsStatCard}>
          <p className="text-xs text-text-muted mb-1">{item.label}</p>
          <p className={`text-2xl font-bold ${item.valueClassName ?? "text-text-primary"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function EconomistPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${swsCard} overflow-hidden ${className}`}>{children}</div>;
}

export function EconomistPanelHeader({
  title,
  subtitle,
  action,
  trailing,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {trailing}
        {action}
      </div>
    </div>
  );
}

export function EconomistPanelBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function EconomistFilterRow({
  children,
  countLabel,
}: {
  children: ReactNode;
  countLabel?: string;
}) {
  return (
    <EconomistPanel>
      <EconomistPanelHeader
        title="필터"
        trailing={countLabel ? <span className="text-xs text-text-muted">{countLabel}</span> : undefined}
      />
      <EconomistPanelBody className="flex flex-wrap items-center gap-3">{children}</EconomistPanelBody>
    </EconomistPanel>
  );
}

export function EconomistTabBar<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  idPrefix?: string;
}) {
  return (
    <div className="flex gap-1 bg-bg-surface border border-border-default rounded-sm p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          id={idPrefix ? `${idPrefix}-${t.id}` : undefined}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 rounded-sm text-sm transition-all ${
            active === t.id ? tabActive : tabInactive
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EconomistEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <EconomistPanel>
      <div className="px-8 py-16 text-center">
        <div className="w-12 h-12 rounded-sm bg-bg-elevated border border-border-default flex items-center justify-center mx-auto mb-4 text-text-muted text-lg">
          —
        </div>
        <p className="text-text-secondary font-medium text-sm">{title}</p>
        {description && <p className="text-text-muted text-xs mt-1">{description}</p>}
      </div>
    </EconomistPanel>
  );
}

export function EconomistAlert({
  children,
  variant = "error",
}: {
  children: ReactNode;
  variant?: "error" | "success";
}) {
  const cls =
    variant === "success"
      ? "p-3 bg-brand-green/10 border border-brand-green/25 rounded-sm text-sm text-brand-green"
      : "p-3 bg-loss-bg border border-loss-border rounded-sm text-sm text-loss-400";
  return <div className={cls}>{children}</div>;
}
