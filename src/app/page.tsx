import { BusinessDashboard } from "@/components/BusinessDashboard";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  return <BusinessDashboard user={user} />;
}
