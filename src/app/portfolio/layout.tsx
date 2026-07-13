import { ReactNode } from "react";
import PortfolioSubNav from "@/components/PortfolioSubNav";

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortfolioSubNav />
      {children}
    </>
  );
}
