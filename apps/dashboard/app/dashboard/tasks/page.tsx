import { AgencyShell, ComingSoon } from "@/components/agency-shell";
import { getCurrentAccount } from "@/lib/server-api";

export default async function TasksPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="tasks" companyName={account?.agencyProfile?.legalName}>
      <ComingSoon />
    </AgencyShell>
  );
}
