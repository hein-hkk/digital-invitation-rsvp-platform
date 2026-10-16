import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveOrganizerSession } from "@/server/auth/session";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";
import { productionClock, type Clock } from "@/server/time/clock";
import type { Database } from "@/types/database.types";
import {
  assertEventMutable,
  getEventRuntimeState,
  getGuestRsvpPolicy,
} from "./domain";
import {
  emptyEventValues,
  eventDatabaseValues,
  eventValuesFromRow,
  validateEventValues,
  type EventRow,
  type EventValues,
} from "./schema";

export type EventErrorCode =
  | "AUTH_REQUIRED"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_MUTABLE"
  | "EVENT_NOT_PUBLISHABLE"
  | "EVENT_INVALID"
  | "EVENT_PERSISTENCE_ERROR";

export class EventServiceError extends Error {
  constructor(
    readonly code: EventErrorCode,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(code);
  }
}

export type EventContext = {
  client: SupabaseClient<Database>;
  organizerId: string;
  clock: Clock;
};

function runtimeEvent(row: EventRow) {
  return {
    publicationStatus: row.publication_status,
    eventDate: row.event_date,
    endTime: row.end_time,
    eventTimezone: row.event_timezone,
  };
}

export function createEventOperations(context: EventContext) {
  const { client, organizerId, clock } = context;

  async function requireOwnedEvent(eventId: string): Promise<EventRow> {
    if (!z.uuid().safeParse(eventId).success) {
      throw new EventServiceError("EVENT_NOT_FOUND");
    }
    const { data, error } = await client
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("owner_user_id", organizerId)
      .maybeSingle();
    if (error) throw new EventServiceError("EVENT_PERSISTENCE_ERROR");
    if (!data) throw new EventServiceError("EVENT_NOT_FOUND");
    return data;
  }

  return {
    async listOwnedEvents() {
      const { data, error } = await client
        .from("events")
        .select(
          "id,event_title,event_date,venue_name,publication_status,end_time,event_timezone",
        )
        .eq("owner_user_id", organizerId)
        .order("created_at", { ascending: false });
      if (error) throw new EventServiceError("EVENT_PERSISTENCE_ERROR");
      return (data ?? []).map((row) => ({
        id: row.id,
        eventTitle: row.event_title,
        eventDate: row.event_date,
        venueName: row.venue_name,
        runtimeState: getEventRuntimeState(
          {
            publicationStatus: row.publication_status,
            eventDate: row.event_date,
            endTime: row.end_time,
            eventTimezone: row.event_timezone,
          },
          clock,
        ),
      }));
    },

    async getEventWorkspace(eventId: string) {
      const event = await requireOwnedEvent(eventId);
      const runtimeState = getEventRuntimeState(runtimeEvent(event), clock);
      return {
        event,
        runtimeState,
        canMutate: runtimeState !== "ended",
      };
    },

    async getEventOverview(eventId: string) {
      const event = await requireOwnedEvent(eventId);
      const observedAt = clock.now();
      const snapshotClock: Clock = { now: () => observedAt };
      const runtimeState = getEventRuntimeState(
        runtimeEvent(event),
        snapshotClock,
      );
      const { data, error } = await client
        .from("invitations")
        .select("id,rsvps(status,attendee_count)")
        .eq("event_id", eventId);
      if (error) throw new EventServiceError("EVENT_PERSISTENCE_ERROR");
      const invitations = data ?? [];
      const metrics = {
        totalInvitations: invitations.length,
        attendingInvitations: 0,
        declinedInvitations: 0,
        awaitingResponseInvitations: 0,
        totalExpectedAttendees: 0,
      };
      for (const invitation of invitations) {
        const rsvp = invitation.rsvps;
        if (rsvp?.status === "attending") {
          metrics.attendingInvitations += 1;
          metrics.totalExpectedAttendees += rsvp.attendee_count;
        } else if (rsvp?.status === "declined") {
          metrics.declinedInvitations += 1;
        } else {
          metrics.awaitingResponseInvitations += 1;
        }
      }
      return {
        event,
        runtimeState,
        ...metrics,
        guestRsvpPolicy: getGuestRsvpPolicy(
          {
            ...runtimeEvent(event),
            rsvpDeadlineLocal: event.rsvp_deadline_local,
          },
          snapshotClock,
        ),
      };
    },

    async createEventDraft(input: Partial<EventValues> = {}) {
      const values = { ...emptyEventValues, ...input };
      const fieldErrors = validateEventValues(values, false);
      if (Object.keys(fieldErrors).length) {
        throw new EventServiceError("EVENT_INVALID", fieldErrors);
      }
      const { data, error } = await client
        .from("events")
        .insert({ owner_user_id: organizerId, ...eventDatabaseValues(values) })
        .select("id")
        .single();
      if (error || !data)
        throw new EventServiceError("EVENT_PERSISTENCE_ERROR");
      return { eventId: data.id, runtimeState: "draft" as const };
    },

    async updateEvent(eventId: string, input: Partial<EventValues>) {
      const event = await requireOwnedEvent(eventId);
      try {
        assertEventMutable(runtimeEvent(event), clock);
      } catch {
        throw new EventServiceError("EVENT_NOT_MUTABLE");
      }
      const values = { ...eventValuesFromRow(event), ...input };
      const fieldErrors = validateEventValues(
        values,
        event.publication_status === "published",
      );
      if (Object.keys(fieldErrors).length) {
        throw new EventServiceError("EVENT_INVALID", fieldErrors);
      }
      const { data, error } = await client
        .from("events")
        .update(eventDatabaseValues(values))
        .eq("id", eventId)
        .eq("owner_user_id", organizerId)
        .select("*")
        .single();
      if (error || !data) {
        // The database trigger also blocks writes when expiration races this check.
        throw new EventServiceError(
          error?.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : "EVENT_PERSISTENCE_ERROR",
        );
      }
      return {
        event: data,
        runtimeState: getEventRuntimeState(runtimeEvent(data), clock),
      };
    },

    async publishEvent(eventId: string) {
      const event = await requireOwnedEvent(eventId);
      if (event.publication_status !== "draft") {
        throw new EventServiceError("EVENT_NOT_PUBLISHABLE");
      }
      const fieldErrors = validateEventValues(eventValuesFromRow(event), true);
      if (Object.keys(fieldErrors).length) {
        throw new EventServiceError("EVENT_NOT_PUBLISHABLE", fieldErrors);
      }
      const { error } = await client.rpc("publish_event", {
        p_event_id: eventId,
      });
      if (error) throw new EventServiceError("EVENT_NOT_PUBLISHABLE");
      const published = await requireOwnedEvent(eventId);
      return {
        runtimeState: "published" as const,
        publishedAt: published.published_at!,
      };
    },
  };
}

async function organizerEventOperations() {
  const session = await resolveOrganizerSession();
  if (!session) throw new EventServiceError("AUTH_REQUIRED");
  const { client, user } = await createAuthenticatedSupabaseClient(
    session.accessToken,
  );
  return createEventOperations({
    client,
    organizerId: user.id,
    clock: productionClock,
  });
}

export async function listOwnedEvents() {
  return (await organizerEventOperations()).listOwnedEvents();
}

export async function getEventWorkspace(eventId: string) {
  return (await organizerEventOperations()).getEventWorkspace(eventId);
}

export async function getEventOverview(eventId: string) {
  return (await organizerEventOperations()).getEventOverview(eventId);
}

export async function createEventDraft(values: Partial<EventValues>) {
  return (await organizerEventOperations()).createEventDraft(values);
}

export async function updateEvent(
  eventId: string,
  values: Partial<EventValues>,
) {
  return (await organizerEventOperations()).updateEvent(eventId, values);
}

export async function publishEvent(eventId: string) {
  return (await organizerEventOperations()).publishEvent(eventId);
}
