import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/server-api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/");
  }

  return <>{children}</>;
}
