import { AgencyShell } from "@/components/agency-shell";
import { AllApplicationsTable } from "@/features/applications/components/all-applications-table";
import { getCurrentAccount } from "@/lib/server-api";

export default async function AllApplicationsPage() {
  const account = await getCurrentAccount();

  return (
    <AgencyShell active="applications" companyName={account?.agencyProfile?.legalName}>
      <AllApplicationsTable />
    </AgencyShell>
  );
}
