import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/server/env";
import type { Database } from "@/types/database.types";

/**
 * Creates an RLS-scoped client from an access token resolved by the server Auth
 * flow. M3 owns cookie/session refresh and supplies the token to this boundary.
 */
export async function createAuthenticatedSupabaseClient(accessToken: string) {
  if (!accessToken) throw new Error("Organizer authentication required");
  const env = getPublicSupabaseEnv();

  const client = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Organizer authentication required");

  return { client, user: data.user };
}
