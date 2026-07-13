import { ReactNode } from "react";
import ResearchSubNav from "@/components/ResearchSubNav";

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ResearchSubNav />
      {children}
    </>
  );
}
