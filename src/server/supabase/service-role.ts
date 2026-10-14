import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServiceRoleEnv } from "@/server/env";

/** Privileged client for narrowly authorized server services only. It bypasses RLS. */
export function createServiceRoleSupabaseClient() {
  const env = getServiceRoleEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
