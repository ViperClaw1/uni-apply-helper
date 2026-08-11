import { AgencyShell } from "@/components/agency-shell";
import { AgencyDashboard } from "@/features/dashboard/components/agency-dashboard";
import { getCurrentAccount } from "@/lib/server-api";

export default async function HomePage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="home" companyName={account?.agencyProfile?.legalName}>
      <AgencyDashboard />
    </AgencyShell>
  );
}
