import PortfolioSubNav from "@/components/PortfolioSubNav";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";
import { computeNetWorth } from "@/lib/net-worth";
import { fetchDisplayCurrency } from "@/lib/display-currency";
import WealthClient from "@/app/wealth/WealthClient";

export const dynamic = "force-dynamic";

export default async function WealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [summary, displayCurrency] = await Promise.all([
    computeNetWorth(),
    fetchDisplayCurrency(),
  ]);

  return (
    <AppPageLayout
       wide
      subNav={<PortfolioSubNav />}
      email={session.user?.email}
      title="Overview"
      subtitle="전체 순자산·비주식 자산 현황"
    >
      <WealthClient
        initial={summary}
        baseCurrency={displayCurrency.baseCurrency}
        fxRates={displayCurrency.fx}
      />
    </AppPageLayout>
  );
}
