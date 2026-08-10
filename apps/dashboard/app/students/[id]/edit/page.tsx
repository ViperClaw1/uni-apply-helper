"use client";

import { useParams } from "next/navigation";
import { AgencyShell } from "@/components/agency-shell";
import { ProfileWizard } from "@/features/students/components/profile-wizard/profile-wizard";

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <AgencyShell active="students">
      <ProfileWizard studentId={id} backHref={`/students/${id}`} />
    </AgencyShell>
  );
}
