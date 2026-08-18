import { LandingPage } from "@/features/marketing/components/landing-page";
import { getCurrentAccount } from "@/lib/server-api";

export default async function WelcomePage() {
  const account = await getCurrentAccount();
  return <LandingPage account={account} />;
}
