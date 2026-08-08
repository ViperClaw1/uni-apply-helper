import { StudentList } from "@/features/students/components/student-list";
import { MyProfileCard } from "@/features/students/components/my-profile-card";
import { getCurrentAccount, getMyStudentProfile } from "@/lib/server-api";

export default async function DashboardPage() {
  const account = await getCurrentAccount();

  if (account?.role !== "student") {
    return <StudentList />;
  }

  const student = await getMyStudentProfile();
  return <MyProfileCard student={student} />;
}
