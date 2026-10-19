import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { resolveOrganizerSession } from "@/server/auth/session";
import { getServiceRoleEnv } from "@/server/env";
import { logger } from "@/server/observability/logger";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";

// Approved V1 defaults from Deployment and Operations, Section 23.
export const rateLimitPolicies = {
  guestReadNetwork: { maxAttempts: 120, windowSeconds: 600 },
  guestReadToken: { maxAttempts: 60, windowSeconds: 600 },
  guestRsvp: { maxAttempts: 20, windowSeconds: 600 },
  otpEmail: { maxAttempts: 5, windowSeconds: 3600 },
  otpNetwork: { maxAttempts: 20, windowSeconds: 3600 },
  organizerHighImpact: { maxAttempts: 30, windowSeconds: 600 },
} as const;

type Policy = keyof typeof rateLimitPolicies;
export type HighImpactOperation =
  | "invitationCreate"
  | "tokenRegeneration"
  | "tokenRevocation"
  | "heroUpload"
  | "heroFinalize"
  | "heroRemoval"
  | "eventPublication"
  | "eventDeletion";

/** Vercel supplies the trusted network signal in production. */
function networkSignal(requestHeaders: Headers): string {
  const header =
    process.env.VERCEL === "1"
      ? requestHeaders.get("x-vercel-forwarded-for")
      : requestHeaders.get("x-forwarded-for");
  const address = header?.split(",", 1)[0]?.trim() ?? "";
  return isIP(address) ? address : "unknown";
}

function bucketHash(policy: Policy, identity: string): string {
  // The existing server-only credential acts as HMAC keying material; the
  // purpose prefix separates rate-limit digests from other uses.
  const secret = getServiceRoleEnv().SUPABASE_SERVICE_ROLE_KEY;
  return createHmac("sha256", secret)
    .update(`rate-limit:v1:${policy}:`)
    .update(identity)
    .digest("hex");
}

async function consume(
  entries: ReadonlyArray<{ policy: Policy; identity: string }>,
): Promise<boolean> {
  // Local development has no public traffic. Production/preview enforce the
  // same approved thresholds and fail closed if the backend is unavailable.
  if (process.env.NODE_ENV !== "production") return true;
  const client = createServiceRoleSupabaseClient();
  for (const { policy, identity } of entries) {
    const limits = rateLimitPolicies[policy];
    const { data, error } = await client.rpc("consume_rate_limit", {
      p_bucket_hash: bucketHash(policy, identity),
      p_max_attempts: limits.maxAttempts,
      p_window_seconds: limits.windowSeconds,
    });
    if (error) throw new Error("Rate-limit backend unavailable");
    if (!data) return false;
  }
  return true;
}

export async function allowGuestInvitationRead(
  rawToken: string,
  requestHeaders: Headers,
): Promise<boolean> {
  const allowed = await consume([
    { policy: "guestReadNetwork", identity: networkSignal(requestHeaders) },
    { policy: "guestReadToken", identity: rawToken.slice(0, 128) },
  ]);
  if (!allowed) {
    logger.log("warn", {
      operation: "rateLimit",
      errorCode: "guestInvitationRead",
      status: "failure",
    });
  }
  return allowed;
}

export async function allowGuestRsvp(rawToken: string): Promise<boolean> {
  const requestHeaders = await headers();
  const allowed = await consume([
    {
      policy: "guestRsvp",
      identity: `${networkSignal(requestHeaders)}:${rawToken.slice(0, 128)}`,
    },
  ]);
  if (!allowed) {
    logger.log("warn", {
      operation: "rateLimit",
      errorCode: "guestRsvp",
      status: "failure",
    });
  }
  return allowed;
}

export async function allowOrganizerOtp(email: string): Promise<boolean> {
  const requestHeaders = await headers();
  const allowed = await consume([
    { policy: "otpNetwork", identity: networkSignal(requestHeaders) },
    { policy: "otpEmail", identity: email.trim().toLowerCase() },
  ]);
  if (!allowed) {
    logger.log("warn", {
      operation: "rateLimit",
      errorCode: "organizerOtp",
      status: "failure",
    });
  }
  return allowed;
}

export async function allowOrganizerHighImpact(
  operation: HighImpactOperation,
): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const session = await resolveOrganizerSession();
  if (!session) return true; // The protected operation will reject the session.
  const allowed = await consume([
    { policy: "organizerHighImpact", identity: session.user.id },
  ]);
  if (!allowed) {
    logger.log("warn", {
      operation: "rateLimit",
      errorCode: operation,
      status: "failure",
    });
  }
  return allowed;
}
