import { AgencyShell, ComingSoon } from "@/components/agency-shell";
import { getCurrentAccount } from "@/lib/server-api";

export default async function UniversitiesPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="universities" companyName={account?.agencyProfile?.legalName}>
      <ComingSoon />
    </AgencyShell>
  );
}
