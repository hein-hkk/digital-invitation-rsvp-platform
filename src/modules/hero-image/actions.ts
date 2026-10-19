"use server";

import { revalidatePath } from "next/cache";
import { allowOrganizerHighImpact } from "@/server/rate-limit";
import {
  HeroImageError,
  prepareHeroImageUpload,
  removeHeroImage,
  setHeroImageReference,
} from "./service";

function message(error: unknown): string {
  if (error instanceof HeroImageError) {
    if (error.code === "EVENT_NOT_MUTABLE")
      return "This Event has ended and is read-only.";
    if (error.code === "INVALID_IMAGE")
      return "Choose a JPEG, PNG, or WebP image up to 10 MiB.";
    if (error.code === "IMAGE_CHANGED")
      return "The Hero Image changed. Refresh and try again.";
    if (error.code === "AUTH_REQUIRED")
      return "Sign in again to manage this Event.";
    if (error.code === "EVENT_NOT_FOUND") return "This Event is unavailable.";
  }
  return "The Hero Image could not be saved. Try again.";
}

function refreshEvent(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/settings`);
  revalidatePath(`/admin/events/${eventId}`);
}

export async function prepareHeroImageUploadAction(input: {
  eventId: string;
  fileName: string;
  contentType: string;
}) {
  try {
    if (!(await allowOrganizerHighImpact("heroUpload"))) {
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    }
    const data = await prepareHeroImageUpload(input);
    return { ok: true as const, ...data };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}

export async function setHeroImageReferenceAction(input: {
  eventId: string;
  storagePath: string;
}) {
  try {
    if (!(await allowOrganizerHighImpact("heroFinalize"))) {
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    }
    await setHeroImageReference(input);
    refreshEvent(input.eventId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}

export async function removeHeroImageAction(eventId: string) {
  try {
    if (!(await allowOrganizerHighImpact("heroRemoval"))) {
      return {
        ok: false as const,
        message: "Too many changes. Try again later.",
      };
    }
    await removeHeroImage(eventId);
    refreshEvent(eventId);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: message(error) };
  }
}
