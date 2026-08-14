import { AgencyShell } from "@/components/agency-shell";
import { UniversitiesList } from "@/features/universities/components/universities-list";
import { getCurrentAccount } from "@/lib/server-api";

export default async function UniversitiesPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="universities" companyName={account?.agencyProfile?.legalName}>
      <UniversitiesList companyName={account?.agencyProfile?.legalName} />
    </AgencyShell>
  );
}
