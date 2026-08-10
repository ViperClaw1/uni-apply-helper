import { AgencyShell, ComingSoon } from "@/components/agency-shell";
import { getCurrentAccount } from "@/lib/server-api";

export default async function SettingsPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="settings" companyName={account?.agencyProfile?.legalName}>
      <ComingSoon />
    </AgencyShell>
  );
}
