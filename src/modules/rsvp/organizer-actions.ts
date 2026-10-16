"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  OrganizerRsvpServiceError,
  updateOrganizerRsvp,
  type OrganizerRsvpInput,
} from "./organizer-service";

export type OrganizerRsvpFormState = {
  values: {
    status: string;
    attendeeCount: string;
    attendeeNames: string;
    dietaryRequirements: string;
  };
  fieldErrors: Record<string, string>;
  message: string | null;
};

export async function updateOrganizerRsvpAction(
  eventId: string,
  invitationId: string,
  _previous: OrganizerRsvpFormState,
  form: FormData,
): Promise<OrganizerRsvpFormState> {
  const values = {
    status: String(form.get("status") ?? ""),
    attendeeCount: String(form.get("attendeeCount") ?? ""),
    attendeeNames: String(form.get("attendeeNames") ?? ""),
    dietaryRequirements: String(form.get("dietaryRequirements") ?? ""),
  };
  const invalid = (fieldErrors: Record<string, string>, message: string) => ({
    values,
    fieldErrors,
    message,
  });
  if (values.status !== "attending" && values.status !== "declined") {
    return invalid(
      { status: "Choose Attending or Declined." },
      "Choose an RSVP status.",
    );
  }
  const count = Number(values.attendeeCount);
  if (
    values.status === "attending" &&
    (!/^\d+$/.test(values.attendeeCount) ||
      !Number.isInteger(count) ||
      count < 1)
  ) {
    return invalid(
      { attendeeCount: "Enter a valid Attendee Count." },
      "Correct the RSVP fields and try again.",
    );
  }
  const input: OrganizerRsvpInput = {
    status: values.status,
    attendeeCount: values.status === "attending" ? count : 0,
    attendeeNames:
      values.status === "attending"
        ? values.attendeeNames
            .split(/\r?\n/)
            .map((name) => name.trim())
            .filter(Boolean)
        : [],
    dietaryRequirements:
      values.status === "attending" ? values.dietaryRequirements : null,
  };
  try {
    await updateOrganizerRsvp(eventId, invitationId, input);
  } catch (error) {
    if (error instanceof OrganizerRsvpServiceError) {
      if (error.code === "AUTH_REQUIRED") redirect("/admin/sign-in");
      if (error.code === "RSVP_PARTY_LIMIT") {
        const message = `Attendee Count can't exceed the Maximum Party Size of ${error.detail ?? "the current Invitation"}.`;
        return invalid({ attendeeCount: message }, message);
      }
      if (error.code === "RSVP_TOO_MANY_NAMES") {
        const message =
          "The number of attendee names can't exceed the Attendee Count.";
        return invalid({ attendeeNames: message }, message);
      }
      return invalid(
        {},
        error.code === "EVENT_NOT_MUTABLE"
          ? "This Event has ended and is read-only."
          : error.code === "INVITATION_NOT_FOUND"
            ? "This Invitation is unavailable."
            : error.code === "RSVP_INVALID"
              ? "Correct the RSVP fields and try again."
              : "The RSVP could not be saved. Try again.",
      );
    }
    return invalid({}, "The RSVP could not be saved. Try again.");
  }
  const path = `/admin/events/${eventId}/invitations/${invitationId}`;
  revalidatePath(path);
  revalidatePath(`/admin/events/${eventId}/invitations`);
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`${path}?rsvpSaved=1`);
}
