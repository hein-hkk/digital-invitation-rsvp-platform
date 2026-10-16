import "server-only";
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serviceRoleSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const invitationSecuritySchema = z.object({
  INVITATION_TOKEN_HASH_KEY: z.string().min(1),
  INVITATION_TOKEN_ENCRYPTION_KEY_V1: z.string().min(1),
  INVITATION_TOKEN_ACTIVE_KEY_VERSION: z.literal("V1"),
  APP_BASE_URL: z.url(),
});

// Validate only when a Supabase boundary is used. The M1 landing page and build
// remain usable before local, synthetic credentials have been created.
export function getPublicSupabaseEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getServiceRoleEnv() {
  return serviceRoleSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function getInvitationSecurityEnv() {
  return invitationSecuritySchema.parse({
    INVITATION_TOKEN_HASH_KEY: process.env.INVITATION_TOKEN_HASH_KEY,
    INVITATION_TOKEN_ENCRYPTION_KEY_V1:
      process.env.INVITATION_TOKEN_ENCRYPTION_KEY_V1,
    INVITATION_TOKEN_ACTIVE_KEY_VERSION:
      process.env.INVITATION_TOKEN_ACTIVE_KEY_VERSION,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });
}
