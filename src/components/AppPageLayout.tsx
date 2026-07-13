import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { pageContainer, pageContainerWide, pageSubtitle, pageTitle } from "@/lib/economist-ui";

type Props = {
  email?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** 대시보드·4열 차트 등 넓은 레이아웃 */
  wide?: boolean;
  headerExtra?: ReactNode;
  subNav?: ReactNode;
};

export default function AppPageLayout({
  email,
  title,
  subtitle,
  children,
  wide = false,
  headerExtra,
  subNav,
}: Props) {
  const container = wide ? pageContainerWide : pageContainer;

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar email={email} />
      {subNav}
      <main className={`${container} flex-1`}>
        {title || headerExtra ? (
          <div
            className={
              headerExtra
                ? "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
                : undefined
            }
          >
            <div>
              {title && <h1 className={pageTitle}>{title}</h1>}
              {subtitle != null && subtitle !== "" && <p className={pageSubtitle}>{subtitle}</p>}
            </div>
            {headerExtra}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
