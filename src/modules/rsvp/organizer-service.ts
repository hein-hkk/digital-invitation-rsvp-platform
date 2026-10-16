import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEventRuntimeState } from "@/modules/events/domain";
import { resolveOrganizerSession } from "@/server/auth/session";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";
import { productionClock, type Clock } from "@/server/time/clock";
import type { Database } from "@/types/database.types";

export type OrganizerRsvpInput = {
  status: "attending" | "declined";
  attendeeCount?: number;
  attendeeNames?: string[];
  dietaryRequirements?: string | null;
};

export type OrganizerRsvpErrorCode =
  | "AUTH_REQUIRED"
  | "INVITATION_NOT_FOUND"
  | "EVENT_NOT_MUTABLE"
  | "RSVP_INVALID"
  | "RSVP_PARTY_LIMIT"
  | "RSVP_TOO_MANY_NAMES"
  | "RSVP_PERSISTENCE_ERROR";

export class OrganizerRsvpServiceError extends Error {
  constructor(
    readonly code: OrganizerRsvpErrorCode,
    readonly detail?: number,
  ) {
    super(code);
  }
}

const inputSchema = z.strictObject({
  status: z.enum(["attending", "declined"]),
  attendeeCount: z.number().int().optional(),
  attendeeNames: z.array(z.string()).max(20).optional(),
  dietaryRequirements: z.string().nullable().optional(),
});

export function createOrganizerRsvpOperations(context: {
  client: SupabaseClient<Database>;
  organizerId: string;
  clock: Clock;
}) {
  return {
    async updateOrganizerRsvp(
      eventId: string,
      invitationId: string,
      input: unknown,
    ) {
      if (
        !z.uuid().safeParse(eventId).success ||
        !z.uuid().safeParse(invitationId).success
      ) {
        throw new OrganizerRsvpServiceError("INVITATION_NOT_FOUND");
      }
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) {
        throw new OrganizerRsvpServiceError("RSVP_INVALID");
      }
      const { data: event, error: eventError } = await context.client
        .from("events")
        .select(
          "id,owner_user_id,publication_status,event_date,end_time,event_timezone",
        )
        .eq("id", eventId)
        .eq("owner_user_id", context.organizerId)
        .maybeSingle();
      if (eventError)
        throw new OrganizerRsvpServiceError("RSVP_PERSISTENCE_ERROR");
      if (!event) throw new OrganizerRsvpServiceError("INVITATION_NOT_FOUND");
      if (
        getEventRuntimeState(
          {
            publicationStatus: event.publication_status,
            eventDate: event.event_date,
            endTime: event.end_time,
            eventTimezone: event.event_timezone,
          },
          context.clock,
        ) === "ended"
      ) {
        throw new OrganizerRsvpServiceError("EVENT_NOT_MUTABLE");
      }
      const { data: invitation, error: invitationError } = await context.client
        .from("invitations")
        .select("id,maximum_party_size")
        .eq("id", invitationId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (invitationError)
        throw new OrganizerRsvpServiceError("RSVP_PERSISTENCE_ERROR");
      if (!invitation)
        throw new OrganizerRsvpServiceError("INVITATION_NOT_FOUND");

      const values = parsed.data;
      const names = (values.attendeeNames ?? [])
        .map((name) => name.trim())
        .filter(Boolean);
      if (values.status === "attending") {
        if (
          !values.attendeeCount ||
          values.attendeeCount < 1 ||
          values.attendeeCount > invitation.maximum_party_size
        ) {
          throw new OrganizerRsvpServiceError(
            "RSVP_PARTY_LIMIT",
            invitation.maximum_party_size,
          );
        }
        if (names.length > values.attendeeCount) {
          throw new OrganizerRsvpServiceError("RSVP_TOO_MANY_NAMES");
        }
      }
      const { data, error } = await context.client.rpc(
        "update_organizer_rsvp",
        {
          p_event_id: eventId,
          p_invitation_id: invitationId,
          p_status: values.status,
          p_attendee_count:
            values.status === "attending" ? values.attendeeCount! : 0,
          p_attendee_names: values.status === "attending" ? names : [],
          p_dietary_requirements:
            values.status === "attending"
              ? (values.dietaryRequirements ?? "")
              : "",
        },
      );
      if (error || !data) {
        if (error?.message === "INVITATION_UNAVAILABLE") {
          throw new OrganizerRsvpServiceError("INVITATION_NOT_FOUND");
        }
        if (error?.message === "EVENT_NOT_MUTABLE") {
          throw new OrganizerRsvpServiceError("EVENT_NOT_MUTABLE");
        }
        if (error?.message.startsWith("RSVP_PARTY_LIMIT:")) {
          throw new OrganizerRsvpServiceError(
            "RSVP_PARTY_LIMIT",
            Number(error.message.split(":")[1]),
          );
        }
        if (error?.message === "RSVP_TOO_MANY_NAMES") {
          throw new OrganizerRsvpServiceError("RSVP_TOO_MANY_NAMES");
        }
        if (error?.message === "RSVP_INVALID") {
          throw new OrganizerRsvpServiceError("RSVP_INVALID");
        }
        throw new OrganizerRsvpServiceError("RSVP_PERSISTENCE_ERROR");
      }
      return { rsvp: data };
    },
  };
}

export async function updateOrganizerRsvp(
  eventId: string,
  invitationId: string,
  input: unknown,
) {
  const session = await resolveOrganizerSession();
  if (!session) throw new OrganizerRsvpServiceError("AUTH_REQUIRED");
  const { client, user } = await createAuthenticatedSupabaseClient(
    session.accessToken,
  );
  return createOrganizerRsvpOperations({
    client,
    organizerId: user.id,
    clock: productionClock,
  }).updateOrganizerRsvp(eventId, invitationId, input);
}
