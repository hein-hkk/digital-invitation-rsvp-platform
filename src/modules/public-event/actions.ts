"use server";

import { revalidatePath } from "next/cache";
import { allowOrganizerHighImpact } from "@/server/rate-limit";
import {
  PublicEventError,
  preparePublicCoverUpload,
  removePublicCover,
  savePublicEventSettings,
  setPublicCoverReference,
} from "./service";

function errorMessage(error: unknown): string {
  if (error instanceof PublicEventError) {
    if (error.code === "AUTH_REQUIRED")
      return "Sign in again to manage this Event.";
    if (error.code === "EVENT_NOT_FOUND") return "This Event is unavailable.";
    if (error.code === "EVENT_NOT_MUTABLE")
      return "This Event has ended and is read-only.";
    if (error.code === "EVENT_NOT_PUBLISHED")
      return "Publish the Event before enabling its public page.";
    if (error.code === "INVALID_IMAGE")
      return "Choose a JPEG, PNG, or WebP image up to 10 MiB.";
    if (error.code === "IMAGE_CHANGED")
      return "The public cover changed. Refresh and try again.";
  }
  return "The public Event page could not be updated. Try again.";
}

function refresh(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/settings`);
  revalidatePath(`/admin/events/${eventId}/public-preview`);
}

export async function savePublicEventSettingsAction(input: {
  eventId: string;
  enabled: boolean;
  announcement: string;
}) {
  try {
    if (!(await allowOrganizerHighImpact("publicEventSettings")))
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    if (
      typeof input.announcement !== "string" ||
      typeof input.enabled !== "boolean"
    )
      return {
        ok: false as const,
        message: "Check the public announcement and try again.",
      };
    await savePublicEventSettings(input);
    refresh(input.eventId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: errorMessage(error) };
  }
}

export async function preparePublicCoverUploadAction(input: {
  eventId: string;
  fileName: string;
  contentType: string;
}) {
  try {
    if (!(await allowOrganizerHighImpact("publicCoverUpload")))
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    const prepared = await preparePublicCoverUpload(input);
    return { ok: true as const, ...prepared };
  } catch (error) {
    return { ok: false as const, message: errorMessage(error) };
  }
}

export async function setPublicCoverReferenceAction(input: {
  eventId: string;
  storagePath: string;
}) {
  try {
    if (!(await allowOrganizerHighImpact("publicCoverFinalize")))
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    await setPublicCoverReference(input);
    refresh(input.eventId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: errorMessage(error) };
  }
}

export async function removePublicCoverAction(eventId: string) {
  try {
    if (!(await allowOrganizerHighImpact("publicCoverRemoval")))
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    await removePublicCover(eventId);
    refresh(eventId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: errorMessage(error) };
  }
}
