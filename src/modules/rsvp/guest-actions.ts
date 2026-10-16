"use server";

import { redirect } from "next/navigation";
import {
  GuestRsvpServiceError,
  submitGuestRsvp,
  type GuestRsvpInput,
} from "./guest-service";
import type { GuestRsvpFormState } from "./guest-form-state";

export async function submitGuestRsvpAction(
  rawToken: string,
  _previous: GuestRsvpFormState,
  form: FormData,
): Promise<GuestRsvpFormState> {
  const status = form.get("status");
  if (status !== "attending" && status !== "declined") {
    return {
      kind: "invalid",
      message: "Choose Attending or Declined.",
      fieldErrors: { status: "Choose Attending or Declined." },
    };
  }
  const count = form.get("attendeeCount");
  const input: GuestRsvpInput = {
    status,
    attendeeCount:
      status === "attending" && typeof count === "string" && count !== ""
        ? Number(count)
        : undefined,
    attendeeNames:
      status === "attending"
        ? form
            .getAll("attendeeNames")
            .filter((name): name is string => typeof name === "string")
        : undefined,
    dietaryRequirements:
      status === "attending" &&
      typeof form.get("dietaryRequirements") === "string"
        ? (form.get("dietaryRequirements") as string)
        : undefined,
    guestMessage:
      typeof form.get("guestMessage") === "string"
        ? (form.get("guestMessage") as string)
        : undefined,
  };
  try {
    await submitGuestRsvp(rawToken, input);
  } catch (error) {
    if (error instanceof GuestRsvpServiceError) {
      switch (error.code) {
        case "INVITATION_UNAVAILABLE":
          return {
            kind: "conflict",
            message: "This invitation link is no longer available.",
            fieldErrors: {},
          };
        case "RSVP_READ_ONLY":
          return {
            kind: "conflict",
            message: "RSVP changes are now closed.",
            fieldErrors: {},
          };
        case "RSVP_PARTY_LIMIT":
          return {
            kind: "conflict",
            message:
              "The invitation details changed. Review the current party limit.",
            fieldErrors: {
              attendeeCount:
                "Select a count within the current invitation limit.",
            },
          };
        case "RSVP_TOO_MANY_NAMES":
          return {
            kind: "invalid",
            message:
              "You have more attendee names than the selected attendee count.",
            fieldErrors: {
              attendeeNames:
                "You have more attendee names than the selected attendee count.",
            },
          };
        case "RSVP_INVALID":
          return {
            kind: "invalid",
            message: "Correct the RSVP fields and try again.",
            fieldErrors: {},
          };
        case "RSVP_PERSISTENCE_ERROR":
          break;
      }
    }
    return {
      kind: "invalid",
      message: "Your RSVP could not be saved. Please try again.",
      fieldErrors: {},
    };
  }
  redirect(`/i/${rawToken}?saved=1#rsvp`);
}
