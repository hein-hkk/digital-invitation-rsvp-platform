"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createInvitation,
  InvitationServiceError,
  updateInvitation,
} from "./service";
import { invitationValuesFromForm, type InvitationValues } from "./schema";

export type InvitationFormState = {
  values: InvitationValues;
  fieldErrors: Record<string, string>;
  message: string | null;
};

export async function createInvitationAction(
  eventId: string,
  _previous: InvitationFormState,
  form: FormData,
): Promise<InvitationFormState> {
  const values = invitationValuesFromForm(form);
  let invitationId: string;
  try {
    ({ invitationId } = await createInvitation(eventId, values));
  } catch (error) {
    if (error instanceof InvitationServiceError) {
      if (error.code === "AUTH_REQUIRED") redirect("/admin/sign-in");
      return {
        values,
        fieldErrors: error.fieldErrors,
        message:
          error.code === "EVENT_NOT_MUTABLE"
            ? "This Event has ended and is read-only."
            : error.code === "EVENT_NOT_FOUND"
              ? "This Event is unavailable."
              : Object.keys(error.fieldErrors).length
                ? "Correct the highlighted fields and try again."
                : "The Invitation could not be created. Try again.",
      };
    }
    return {
      values,
      fieldErrors: {},
      message: "The Invitation could not be created. Try again.",
    };
  }
  revalidatePath(`/admin/events/${eventId}/invitations`);
  redirect(`/admin/events/${eventId}/invitations/${invitationId}`);
}

export async function updateInvitationAction(
  eventId: string,
  invitationId: string,
  _previous: InvitationFormState,
  form: FormData,
): Promise<InvitationFormState> {
  const values = invitationValuesFromForm(form);
  try {
    await updateInvitation(eventId, invitationId, values);
  } catch (error) {
    if (error instanceof InvitationServiceError) {
      if (error.code === "AUTH_REQUIRED") redirect("/admin/sign-in");
      return {
        values,
        fieldErrors: error.fieldErrors,
        message:
          error.code === "EVENT_NOT_MUTABLE"
            ? "This Event has ended and is read-only."
            : error.code === "INVITATION_NOT_FOUND" ||
                error.code === "EVENT_NOT_FOUND"
              ? "This Invitation is unavailable."
              : error.code === "MAX_PARTY_SIZE_CONFLICT"
                ? error.fieldErrors.maximumPartySize
                : Object.keys(error.fieldErrors).length
                  ? "Correct the highlighted fields and try again."
                  : "The Invitation could not be saved. Try again.",
      };
    }
    return {
      values,
      fieldErrors: {},
      message: "The Invitation could not be saved. Try again.",
    };
  }
  revalidatePath(`/admin/events/${eventId}/invitations`);
  revalidatePath(`/admin/events/${eventId}/invitations/${invitationId}`);
  redirect(
    `/admin/events/${eventId}/invitations/${invitationId}?invitationSaved=1`,
  );
}
