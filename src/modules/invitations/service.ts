import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEventRuntimeState } from "@/modules/events/domain";
import { resolveOrganizerSession } from "@/server/auth/session";
import {
  createInvitationCredential,
  decryptInvitationToken,
  invitationUrl,
  loadInvitationTokenConfig,
  tokenLookupHash,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import { productionClock, type Clock } from "@/server/time/clock";
import type { Database } from "@/types/database.types";
import { validateInvitationValues, type InvitationValues } from "./schema";

export type InvitationErrorCode =
  | "AUTH_REQUIRED"
  | "EVENT_NOT_FOUND"
  | "INVITATION_NOT_FOUND"
  | "INVITATION_REVOKED"
  | "EVENT_NOT_MUTABLE"
  | "INVITATION_INVALID"
  | "MAX_PARTY_SIZE_CONFLICT"
  | "INVITATION_PERSISTENCE_ERROR";

export class InvitationServiceError extends Error {
  constructor(
    readonly code: InvitationErrorCode,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(code);
  }
}

export type InvitationContext = {
  client: SupabaseClient<Database>;
  credentialClient: SupabaseClient<Database>;
  organizerId: string;
  clock: Clock;
  tokenConfig: InvitationTokenConfig;
};

export type InvitationListOptions = {
  search?: string;
  rsvpStatus?: "awaiting_response" | "attending" | "declined";
};

export function createInvitationOperations(context: InvitationContext) {
  const { client, credentialClient, organizerId, clock, tokenConfig } = context;

  async function requireEvent(eventId: string) {
    if (!z.uuid().safeParse(eventId).success) {
      throw new InvitationServiceError("EVENT_NOT_FOUND");
    }
    const { data: event, error } = await client
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("owner_user_id", organizerId)
      .maybeSingle();
    if (error) throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
    if (!event) throw new InvitationServiceError("EVENT_NOT_FOUND");
    const runtimeState = getEventRuntimeState(
      {
        publicationStatus: event.publication_status,
        eventDate: event.event_date,
        endTime: event.end_time,
        eventTimezone: event.event_timezone,
      },
      clock,
    );
    return { event, runtimeState, canMutate: runtimeState !== "ended" };
  }

  return {
    async listEventInvitations(
      eventId: string,
      options: InvitationListOptions = {},
    ) {
      const workspace = await requireEvent(eventId);
      const { data, error } = await client
        .from("invitations")
        .select(
          "id,invitee_name,maximum_party_size,revoked_at,rsvps(status,attendee_count,response_updated_at)",
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error)
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      const allInvitations = data ?? [];
      const search = (options.search ?? "").trim().toLocaleLowerCase();
      const invitations = allInvitations.filter(
        (invitation) =>
          (!search ||
            invitation.invitee_name.toLocaleLowerCase().includes(search)) &&
          (!options.rsvpStatus ||
            invitation.rsvps?.status === options.rsvpStatus),
      );
      return {
        ...workspace,
        invitations,
        totalInvitationCount: allInvitations.length,
      };
    },

    async createInvitation(eventId: string, values: InvitationValues) {
      const workspace = await requireEvent(eventId);
      if (!workspace.canMutate) {
        throw new InvitationServiceError("EVENT_NOT_MUTABLE");
      }
      const validated = validateInvitationValues(values);
      if (!validated.valid || validated.maximumPartySize === null) {
        throw new InvitationServiceError(
          "INVITATION_INVALID",
          validated.fieldErrors,
        );
      }
      const credential = createInvitationCredential(tokenConfig);
      const { data: invitationId, error } = await credentialClient.rpc(
        "create_invitation_record",
        {
          p_owner_user_id: organizerId,
          p_event_id: eventId,
          p_invitee_name: validated.inviteeName,
          p_maximum_party_size: validated.maximumPartySize,
          p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
          p_token_ciphertext: credential.ciphertext,
          p_token_key_version: credential.keyVersion,
        },
      );
      if (error || !invitationId) {
        throw new InvitationServiceError(
          error?.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : "INVITATION_PERSISTENCE_ERROR",
        );
      }
      return {
        invitationId,
        currentInvitationUrl: invitationUrl(credential.rawToken, tokenConfig),
      };
    },

    async updateInvitation(
      eventId: string,
      invitationId: string,
      values: InvitationValues,
    ) {
      const workspace = await requireEvent(eventId);
      if (!z.uuid().safeParse(invitationId).success) {
        throw new InvitationServiceError("INVITATION_NOT_FOUND");
      }
      if (!workspace.canMutate) {
        throw new InvitationServiceError("EVENT_NOT_MUTABLE");
      }
      const validated = validateInvitationValues(values);
      if (!validated.valid || validated.maximumPartySize === null) {
        throw new InvitationServiceError(
          "INVITATION_INVALID",
          validated.fieldErrors,
        );
      }
      const { data, error } = await client.rpc("update_invitation_record", {
        p_event_id: eventId,
        p_invitation_id: invitationId,
        p_invitee_name: validated.inviteeName,
        p_maximum_party_size: validated.maximumPartySize,
      });
      if (error || !data) {
        if (error?.message === "EVENT_NOT_MUTABLE") {
          throw new InvitationServiceError("EVENT_NOT_MUTABLE");
        }
        if (error?.message === "INVITATION_UNAVAILABLE") {
          throw new InvitationServiceError("INVITATION_NOT_FOUND");
        }
        if (error?.message.startsWith("MAX_PARTY_SIZE_CONFLICT:")) {
          const attendeeCount = Number(error.message.split(":")[1]);
          throw new InvitationServiceError("MAX_PARTY_SIZE_CONFLICT", {
            maximumPartySize: `Maximum Party Size can't be lower than the current Attendee Count of ${attendeeCount}. Update the RSVP first, then lower the party size.`,
          });
        }
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      }
      return { invitation: data };
    },

    async regenerateInvitationToken(eventId: string, invitationId: string) {
      const workspace = await requireEvent(eventId);
      if (!z.uuid().safeParse(invitationId).success) {
        throw new InvitationServiceError("INVITATION_NOT_FOUND");
      }
      if (!workspace.canMutate) {
        throw new InvitationServiceError("EVENT_NOT_MUTABLE");
      }
      // Scope the privileged credential operation to the authenticated owner.
      const { data: invitation, error: invitationError } = await client
        .from("invitations")
        .select("id,revoked_at")
        .eq("id", invitationId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (invitationError) {
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      }
      if (!invitation) throw new InvitationServiceError("INVITATION_NOT_FOUND");
      if (invitation.revoked_at) {
        throw new InvitationServiceError("INVITATION_REVOKED");
      }
      const credential = createInvitationCredential(tokenConfig);
      const { data: tokenCreatedAt, error } = await credentialClient.rpc(
        "replace_invitation_credential",
        {
          p_owner_user_id: organizerId,
          p_invitation_id: invitationId,
          p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
          p_token_ciphertext: credential.ciphertext,
          p_token_key_version: credential.keyVersion,
        },
      );
      if (error || !tokenCreatedAt) {
        if (error?.message === "EVENT_NOT_MUTABLE") {
          throw new InvitationServiceError("EVENT_NOT_MUTABLE");
        }
        if (error?.message === "INVITATION_REVOKED") {
          throw new InvitationServiceError("INVITATION_REVOKED");
        }
        if (error?.message === "INVITATION_UNAVAILABLE") {
          throw new InvitationServiceError("INVITATION_NOT_FOUND");
        }
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      }
      return {
        currentInvitationUrl: invitationUrl(credential.rawToken, tokenConfig),
        tokenCreatedAt,
      };
    },

    async revokeInvitation(eventId: string, invitationId: string) {
      const workspace = await requireEvent(eventId);
      if (!z.uuid().safeParse(invitationId).success) {
        throw new InvitationServiceError("INVITATION_NOT_FOUND");
      }
      if (!workspace.canMutate) {
        throw new InvitationServiceError("EVENT_NOT_MUTABLE");
      }
      const { data: revokedAt, error } = await client.rpc(
        "revoke_invitation_record",
        { p_event_id: eventId, p_invitation_id: invitationId },
      );
      if (error || !revokedAt) {
        if (error?.message === "EVENT_NOT_MUTABLE") {
          throw new InvitationServiceError("EVENT_NOT_MUTABLE");
        }
        if (error?.message === "INVITATION_REVOKED") {
          throw new InvitationServiceError("INVITATION_REVOKED");
        }
        if (error?.message === "INVITATION_UNAVAILABLE") {
          throw new InvitationServiceError("INVITATION_NOT_FOUND");
        }
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      }
      return { accessState: "revoked" as const, revokedAt };
    },

    async getInvitationAdminDetail(eventId: string, invitationId: string) {
      const workspace = await requireEvent(eventId);
      if (!z.uuid().safeParse(invitationId).success) {
        throw new InvitationServiceError("INVITATION_NOT_FOUND");
      }
      const { data: invitation, error } = await client
        .from("invitations")
        .select("*")
        .eq("id", invitationId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error)
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      if (!invitation) throw new InvitationServiceError("INVITATION_NOT_FOUND");
      const { data: rsvp, error: rsvpError } = await client
        .from("rsvps")
        .select("*")
        .eq("invitation_id", invitationId)
        .single();
      if (rsvpError || !rsvp) {
        throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
      }
      let currentInvitationUrl: string | null = null;
      if (!invitation.revoked_at && workspace.runtimeState !== "ended") {
        // The RLS-scoped owner and Invitation checks above precede this
        // privileged credential read. Credential columns never enter lists.
        const { data: credential, error: credentialError } =
          await credentialClient
            .from("invitation_access_credentials")
            .select("token_ciphertext,token_key_version,token_lookup_hash")
            .eq("invitation_id", invitationId)
            .single();
        if (credentialError || !credential) {
          throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
        }
        try {
          const token = decryptInvitationToken(
            credential.token_ciphertext,
            credential.token_key_version,
            tokenConfig,
          );
          const expected = tokenLookupHash(token, tokenConfig);
          const stored = Buffer.from(
            credential.token_lookup_hash.replace(/^\\x/, ""),
            "hex",
          );
          if (
            stored.length !== expected.length ||
            !timingSafeEqual(stored, expected)
          ) {
            throw new Error("Credential integrity failure");
          }
          currentInvitationUrl = invitationUrl(token, tokenConfig);
        } catch {
          throw new InvitationServiceError("INVITATION_PERSISTENCE_ERROR");
        }
      }
      return {
        ...workspace,
        invitation,
        rsvp,
        accessState: invitation.revoked_at
          ? ("revoked" as const)
          : ("active" as const),
        currentInvitationUrl,
      };
    },
  };
}

async function organizerInvitationOperations() {
  const session = await resolveOrganizerSession();
  if (!session) throw new InvitationServiceError("AUTH_REQUIRED");
  const { client, user } = await createAuthenticatedSupabaseClient(
    session.accessToken,
  );
  return createInvitationOperations({
    client,
    credentialClient: createServiceRoleSupabaseClient(),
    organizerId: user.id,
    clock: productionClock,
    tokenConfig: loadInvitationTokenConfig(),
  });
}

export async function listEventInvitations(
  eventId: string,
  options: InvitationListOptions = {},
) {
  return (await organizerInvitationOperations()).listEventInvitations(
    eventId,
    options,
  );
}

export async function createInvitation(
  eventId: string,
  values: InvitationValues,
) {
  return (await organizerInvitationOperations()).createInvitation(
    eventId,
    values,
  );
}

export async function getInvitationAdminDetail(
  eventId: string,
  invitationId: string,
) {
  return (await organizerInvitationOperations()).getInvitationAdminDetail(
    eventId,
    invitationId,
  );
}

export async function updateInvitation(
  eventId: string,
  invitationId: string,
  values: InvitationValues,
) {
  return (await organizerInvitationOperations()).updateInvitation(
    eventId,
    invitationId,
    values,
  );
}

export async function regenerateInvitationToken(
  eventId: string,
  invitationId: string,
) {
  return (await organizerInvitationOperations()).regenerateInvitationToken(
    eventId,
    invitationId,
  );
}

export async function revokeInvitation(eventId: string, invitationId: string) {
  return (await organizerInvitationOperations()).revokeInvitation(
    eventId,
    invitationId,
  );
}
