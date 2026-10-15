import type { Clock } from "@/server/time/clock";
import {
  eventLocalToInstant,
  getEventRuntimeState,
  type EventForRuntime,
} from "@/modules/events/domain";

export type RsvpStatus = "awaiting_response" | "attending" | "declined";

export function isValidMaximumPartySize(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 20;
}

export type RsvpInput = {
  status: "attending" | "declined";
  attendeeCount?: number;
  attendeeNames?: string[];
  dietaryRequirements?: string | null;
  guestMessage?: string | null;
};

export type NormalizedRsvp = {
  status: "attending" | "declined";
  attendeeCount: number;
  attendeeNames: string[];
  dietaryRequirements: string | null;
  guestMessage: string | null;
};

export function normalizeRsvp(
  input: RsvpInput,
  maximumPartySize: number,
  currentGuestMessage: string | null = null,
): NormalizedRsvp {
  if (!isValidMaximumPartySize(maximumPartySize)) {
    throw new RangeError("Invalid Maximum Party Size");
  }
  const guestMessage =
    input.guestMessage === undefined ? currentGuestMessage : input.guestMessage;
  if (input.status === "declined") {
    return {
      status: "declined",
      attendeeCount: 0,
      attendeeNames: [],
      dietaryRequirements: null,
      guestMessage,
    };
  }
  if (
    input.status !== "attending" ||
    !Number.isInteger(input.attendeeCount) ||
    input.attendeeCount === undefined ||
    input.attendeeCount < 1 ||
    input.attendeeCount > maximumPartySize
  ) {
    throw new RangeError("Attendee Count must be within Maximum Party Size");
  }
  const attendeeNames = input.attendeeNames ?? [];
  if (attendeeNames.length > input.attendeeCount) {
    throw new RangeError("Attendee Names cannot exceed Attendee Count");
  }
  return {
    status: "attending",
    attendeeCount: input.attendeeCount,
    attendeeNames,
    dietaryRequirements: input.dietaryRequirements ?? null,
    guestMessage,
  };
}

export function canReduceMaximumPartySize(
  proposed: unknown,
  currentAttendeeCount: number,
): proposed is number {
  return isValidMaximumPartySize(proposed) && proposed >= currentAttendeeCount;
}

export function getGuestRsvpPermission(
  event: EventForRuntime & { rsvpDeadlineLocal: string | null },
  access: { isCurrentToken: boolean; revokedAt: string | null },
  clock: Clock,
): { canReadInvitation: boolean; canEditRsvp: boolean } {
  const canReadInvitation =
    access.isCurrentToken &&
    access.revokedAt === null &&
    getEventRuntimeState(event, clock) === "published";
  const canEditRsvp =
    canReadInvitation &&
    (event.rsvpDeadlineLocal === null ||
      clock.now().getTime() <
        eventLocalToInstant(
          event.rsvpDeadlineLocal,
          event.eventTimezone!,
        ).getTime());
  return { canReadInvitation, canEditRsvp };
}
