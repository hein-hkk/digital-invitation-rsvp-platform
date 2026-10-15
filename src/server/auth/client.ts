import "server-only";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/server/env";

export const organizerCookie = "organizer-auth-session";

export const organizerCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Supabase owns session persistence and refresh through its supported storage API. */
export function createOrganizerAuthClient(storage: SupportedStorage) {
  const env = getPublicSupabaseEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        storage,
        storageKey: organizerCookie,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    },
  );
}
