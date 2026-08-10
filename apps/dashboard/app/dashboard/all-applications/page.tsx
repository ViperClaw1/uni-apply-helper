import { AgencyShell, ComingSoon } from "@/components/agency-shell";
import { getCurrentAccount } from "@/lib/server-api";

export default async function AllApplicationsPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="applications" companyName={account?.agencyProfile?.legalName}>
      <ComingSoon />
    </AgencyShell>
  );
}
