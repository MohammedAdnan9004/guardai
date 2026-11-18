import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  getSupabaseConfig,
  getSupabaseServiceRoleKey,
  GUARDAI_COOKIES,
} from "./config";

/**
 * Creates a request-scoped Supabase Server Client backed by HTTP cookies.
 * Always instantiate per-request inside Server Components, Route Handlers, or Actions.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const { url, anonKey, configured } = getSupabaseConfig();
  if (!configured) {
    return null;
  }

  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          const rememberMe =
            cookieStore.get(GUARDAI_COOKIES.rememberMe)?.value === "1";

          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieConfig = {
              ...options,
              sameSite: "lax" as const,
              secure: isProd,
              path: "/",
            };

            // If user did NOT check Remember Me and value is non-empty, keep cookie session-scoped
            if (
              !rememberMe &&
              value !== "" &&
              cookieConfig.maxAge &&
              cookieConfig.maxAge > 0
            ) {
              delete cookieConfig.maxAge;
              delete cookieConfig.expires;
            }

            cookieStore.set(name, value, cookieConfig);
          });
        } catch {
          // Called from a Server Component render where cookie writes are read-only;
          // proxy.ts handles token refresh cookie persistence on incoming requests.
        }
      },
    },
  });
}

/**
 * Creates a privileged Service Role client for server-only administrative operations
 * (e.g., force logout, user deletion, cross-tenant global metrics, audit logging).
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const { url, configured } = getSupabaseConfig();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!configured || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
