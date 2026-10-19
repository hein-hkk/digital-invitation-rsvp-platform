"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { allowOrganizerHighImpact } from "@/server/rate-limit";
import {
  createEventDraft,
  deleteEvent,
  EventServiceError,
  publishEvent,
  updateEvent,
} from "./service";
import { eventValuesFromForm, type EventValues } from "./schema";

export type EventFormState = {
  status: "idle" | "error" | "saved";
  values: EventValues;
  fieldErrors: Record<string, string>;
  message: string | null;
};

function failure(error: unknown, values: EventValues): EventFormState {
  if (error instanceof EventServiceError) {
    if (error.code === "AUTH_REQUIRED") redirect("/admin/sign-in");
    return {
      status: "error",
      values,
      fieldErrors: error.fieldErrors,
      message:
        error.code === "EVENT_NOT_MUTABLE"
          ? "This Event has ended and is read-only."
          : Object.keys(error.fieldErrors).length
            ? "Correct the highlighted fields and try again."
            : "The Event could not be saved. Try again.",
    };
  }
  return {
    status: "error",
    values,
    fieldErrors: {},
    message: "The Event could not be saved. Try again.",
  };
}

export async function createEventDraftAction(
  _previous: EventFormState,
  form: FormData,
): Promise<EventFormState> {
  const values = eventValuesFromForm(form);
  let eventId: string;
  try {
    ({ eventId } = await createEventDraft(values));
  } catch (error) {
    return failure(error, values);
  }
  revalidatePath("/admin/events");
  redirect(`/admin/events/${eventId}`);
}

export async function updateEventAction(
  eventId: string,
  _previous: EventFormState,
  form: FormData,
): Promise<EventFormState> {
  const values = eventValuesFromForm(form);
  try {
    await updateEvent(eventId, values);
  } catch (error) {
    return failure(error, values);
  }
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/settings`);
  return { status: "saved", values, fieldErrors: {}, message: "Saved" };
}

export async function publishEventAction(form: FormData): Promise<void> {
  const parsed = z.uuid().safeParse(form.get("eventId"));
  if (!parsed.success) notFound();
  const eventId = parsed.data;
  let outcome: "success" | "blocked" | "failed" = "success";
  try {
    if (!(await allowOrganizerHighImpact("eventPublication"))) {
      outcome = "failed";
    } else {
      await publishEvent(eventId);
    }
  } catch (error) {
    if (error instanceof EventServiceError) {
      if (error.code === "AUTH_REQUIRED") redirect("/admin/sign-in");
      if (error.code === "EVENT_NOT_FOUND") notFound();
      outcome =
        error.code === "EVENT_NOT_PUBLISHABLE" &&
        Object.keys(error.fieldErrors).length
          ? "blocked"
          : "failed";
    } else {
      outcome = "failed";
    }
  }
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/settings`);
  if (outcome === "success") redirect(`/admin/events/${eventId}?published=1`);
  redirect(`/admin/events/${eventId}/settings?publish=${outcome}`);
}

export type EventDeleteState = { message: string | null };

export async function deleteEventAction(
  eventId: string,
  _previous: EventDeleteState,
  _form: FormData,
): Promise<EventDeleteState> {
  void _previous;
  void _form;
  try {
    if (!(await allowOrganizerHighImpact("eventDeletion"))) {
      return { message: "Too many changes. Try again later." };
    }
    await deleteEvent(eventId);
  } catch (error) {
    if (error instanceof EventServiceError) {
      if (error.code === "AUTH_REQUIRED") redirect("/admin/sign-in");
      return {
        message:
          error.code === "EVENT_NOT_DELETABLE"
            ? "This Event is active and cannot be deleted."
            : error.code === "EVENT_NOT_FOUND"
              ? "This Event is no longer available."
              : "The Event could not be deleted. Try again.",
      };
    }
    return { message: "The Event could not be deleted. Try again." };
  }
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
