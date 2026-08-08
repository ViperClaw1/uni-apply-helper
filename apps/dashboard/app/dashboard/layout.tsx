import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieHeader = (await cookies()).toString();
  const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, "");

  const response = apiOrigin
    ? await fetch(`${apiOrigin}/auth/me`, {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      })
    : null;

  if (!response?.ok) {
    redirect("/");
  }

  return <>{children}</>;
}
