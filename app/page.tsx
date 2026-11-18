import { getSessionContext } from "@/lib/auth/dal";
import { LandingView } from "@/components/landing/landing-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionContext();

  return (
    <LandingView
      isAuthenticated={Boolean(session)}
      userRole={session?.effectiveRole ?? null}
      workspaceName={session?.workspace?.name ?? null}
    />
  );
}
