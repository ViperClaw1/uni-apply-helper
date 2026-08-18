import { AgencyShell } from "@/components/agency-shell";
import { AgencyDashboard } from "@/features/dashboard/components/agency-dashboard";
import { LandingPage } from "@/features/marketing/components/landing-page";
import { getCurrentAccount } from "@/lib/server-api";

export default async function Home() {
  const account = await getCurrentAccount();

  if (account && account.role !== "student") {
    return (
      <AgencyShell active="home" companyName={account.agencyProfile?.legalName}>
        <AgencyDashboard />
      </AgencyShell>
    );
  }

  return <LandingPage account={account} />;
}
