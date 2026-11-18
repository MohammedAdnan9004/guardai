import type { NextRequest } from "next/server";
import { updateSessionAndGuardRoutes } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSessionAndGuardRoutes(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, images, and API routes
     * (API routes perform their own CSRF, rate-limit, and session validation).
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
