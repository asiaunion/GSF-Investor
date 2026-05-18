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
};

export default function AppPageLayout({
  email,
  title,
  subtitle,
  children,
  wide = false,
  headerExtra,
}: Props) {
  const container = wide ? pageContainerWide : pageContainer;

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar email={email} />
      <main className={container}>
        <div
          className={
            headerExtra
              ? "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
              : undefined
          }
        >
          <div>
            <h1 className={pageTitle}>{title}</h1>
            {subtitle != null && subtitle !== "" && <p className={pageSubtitle}>{subtitle}</p>}
          </div>
          {headerExtra}
        </div>
        {children}
      </main>
    </div>
  );
}
