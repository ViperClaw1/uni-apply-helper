import { AgencyShell, ComingSoon } from "@/components/agency-shell";
import { getCurrentAccount } from "@/lib/server-api";

export default async function TeamPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="team" companyName={account?.agencyProfile?.legalName}>
      <ComingSoon />
    </AgencyShell>
  );
}
