import { AgencyShell } from "@/components/agency-shell";
import { StudentDetailPage } from "@/features/students/components/student-detail-page";

export default function Page() {
  return (
    <AgencyShell active="students">
      <StudentDetailPage />
    </AgencyShell>
  );
}
