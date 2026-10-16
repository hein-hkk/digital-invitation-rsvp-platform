import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  isInvitationToken,
  loadInvitationTokenConfig,
  tokenLookupHash,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import type { Database } from "@/types/database.types";
import type { GuestInvitationView } from "@/modules/guest-access/service";

export type GuestRsvpInput = {
  status: "attending" | "declined";
  attendeeCount?: number;
  attendeeNames?: string[];
  dietaryRequirements?: string | null;
  guestMessage?: string | null;
};

export type GuestRsvpErrorCode =
  | "INVITATION_UNAVAILABLE"
  | "RSVP_READ_ONLY"
  | "RSVP_INVALID"
  | "RSVP_PARTY_LIMIT"
  | "RSVP_TOO_MANY_NAMES"
  | "RSVP_PERSISTENCE_ERROR";

export class GuestRsvpServiceError extends Error {
  constructor(readonly code: GuestRsvpErrorCode) {
    super(code);
  }
}

const inputSchema = z.strictObject({
  status: z.enum(["attending", "declined"]),
  attendeeCount: z.number().int().optional(),
  attendeeNames: z.array(z.string()).max(20).optional(),
  dietaryRequirements: z.string().nullable().optional(),
  guestMessage: z.string().nullable().optional(),
});

const savedRsvpSchema = z.object({
  status: z.enum(["attending", "declined"]),
  attendeeCount: z.number().int(),
  attendeeNames: z.array(z.string()),
  dietaryRequirements: z.string().nullable(),
  guestMessage: z.string().nullable(),
  respondedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export function createGuestRsvpOperations(context: {
  client: SupabaseClient<Database>;
  tokenConfig: InvitationTokenConfig;
  /** Used only for deterministic local tests; production reads the database clock after locks. */
  observedAt?: () => Date;
}) {
  return {
    async submitGuestRsvp(
      rawToken: string,
      input: GuestRsvpInput,
    ): Promise<{ rsvp: GuestInvitationView["rsvp"] }> {
      if (!isInvitationToken(rawToken)) {
        throw new GuestRsvpServiceError("INVITATION_UNAVAILABLE");
      }
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) throw new GuestRsvpServiceError("RSVP_INVALID");
      const value = parsed.data;
      const attendeeNames = (value.attendeeNames ?? [])
        .map((name) => name.trim())
        .filter(Boolean);
      if (value.status === "attending") {
        if (!value.attendeeCount || value.attendeeCount < 1) {
          throw new GuestRsvpServiceError("RSVP_PARTY_LIMIT");
        }
        if (attendeeNames.length > value.attendeeCount) {
          throw new GuestRsvpServiceError("RSVP_TOO_MANY_NAMES");
        }
      }

      const lookupHash = `\\x${tokenLookupHash(rawToken, context.tokenConfig).toString("hex")}`;
      const { data, error } = await context.client.rpc("submit_guest_rsvp", {
        p_token_lookup_hash: lookupHash,
        p_status: value.status,
        p_attendee_count:
          value.status === "attending" ? value.attendeeCount! : 0,
        p_attendee_names: value.status === "attending" ? attendeeNames : [],
        p_dietary_requirements:
          value.status === "attending" ? (value.dietaryRequirements ?? "") : "",
        p_guest_message: value.guestMessage ?? "",
        p_guest_message_present: value.guestMessage !== undefined,
        ...(context.observedAt
          ? { p_observed_at: context.observedAt().toISOString() }
          : {}),
      });
      if (error) {
        const code = error.message;
        if (
          code === "INVITATION_UNAVAILABLE" ||
          code === "RSVP_READ_ONLY" ||
          code === "RSVP_INVALID" ||
          code === "RSVP_PARTY_LIMIT" ||
          code === "RSVP_TOO_MANY_NAMES"
        ) {
          throw new GuestRsvpServiceError(code);
        }
        throw new GuestRsvpServiceError("RSVP_PERSISTENCE_ERROR");
      }
      const saved = savedRsvpSchema.safeParse(data);
      if (!saved.success)
        throw new GuestRsvpServiceError("RSVP_PERSISTENCE_ERROR");
      return { rsvp: saved.data };
    },
  };
}

export async function submitGuestRsvp(rawToken: string, input: GuestRsvpInput) {
  return createGuestRsvpOperations({
    client: createServiceRoleSupabaseClient(),
    tokenConfig: loadInvitationTokenConfig(),
  }).submitGuestRsvp(rawToken, input);
}
