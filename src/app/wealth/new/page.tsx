import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppPageLayout from "@/components/AppPageLayout";
import WealthNewForm from "./WealthNewForm";

export default async function WealthNewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppPageLayout email={session.user?.email} title="자산·부채 항목 추가">
      <WealthNewForm />
    </AppPageLayout>
  );
}
