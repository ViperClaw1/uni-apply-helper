import { redirect } from "next/navigation";
import { AgencyShell } from "@/components/agency-shell";
import { StudentList } from "@/features/students/components/student-list";
import { getCurrentAccount } from "@/lib/server-api";

export default async function StudentsPage() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/");
  }

  if (account.role === "student") {
    redirect("/dashboard");
  }

  return (
    <AgencyShell active="students" companyName={account.agencyProfile?.legalName}>
      <StudentList companyName={account.agencyProfile?.legalName} />
    </AgencyShell>
  );
}
