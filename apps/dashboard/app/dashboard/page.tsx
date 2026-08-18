import { redirect } from "next/navigation";
import { MyProfileCard } from "@/features/students/components/my-profile-card";
import { getCurrentAccount, getMyStudentProfile } from "@/lib/server-api";

export default async function DashboardPage() {
  const account = await getCurrentAccount();

  if (account?.role !== "student") {
    redirect("/");
  }

  const student = await getMyStudentProfile();
  return <MyProfileCard student={student} />;
}
