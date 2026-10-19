import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEventRuntimeState } from "@/modules/events/domain";
import { logger } from "@/server/observability/logger";
import { resolveOrganizerSession } from "@/server/auth/session";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import { productionClock, type Clock } from "@/server/time/clock";
import type { Database } from "@/types/database.types";
import {
  HERO_IMAGE_BUCKET,
  HERO_IMAGE_MAX_BYTES,
  HERO_IMAGE_SIGNED_READ_SECONDS,
  heroImageExtension,
  isEventHeroImagePath,
  matchesHeroImageSignature,
  type HeroImageType,
} from "./validation";

export type HeroImageErrorCode =
  | "AUTH_REQUIRED"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_MUTABLE"
  | "INVALID_IMAGE"
  | "IMAGE_CHANGED"
  | "IMAGE_STORAGE_ERROR";

export class HeroImageError extends Error {
  constructor(readonly code: HeroImageErrorCode) {
    super(code);
  }
}

type Context = {
  client: SupabaseClient<Database>;
  storage: SupabaseClient<Database>;
  organizerId: string;
  clock: Clock;
};

export function createHeroImageOperations({
  client,
  storage,
  organizerId,
  clock,
}: Context) {
  const bucket = storage.storage.from(HERO_IMAGE_BUCKET);

  async function ownedEvent(eventId: string, mutable: boolean) {
    if (!z.uuid().safeParse(eventId).success)
      throw new HeroImageError("EVENT_NOT_FOUND");
    const { data, error } = await client
      .from("events")
      .select(
        "id,owner_user_id,publication_status,event_date,end_time,event_timezone,hero_image_storage_path",
      )
      .eq("id", eventId)
      .eq("owner_user_id", organizerId)
      .maybeSingle();
    if (error) throw new HeroImageError("IMAGE_STORAGE_ERROR");
    if (!data) throw new HeroImageError("EVENT_NOT_FOUND");
    if (
      mutable &&
      getEventRuntimeState(
        {
          publicationStatus: data.publication_status,
          eventDate: data.event_date,
          endTime: data.end_time,
          eventTimezone: data.event_timezone,
        },
        clock,
      ) === "ended"
    )
      throw new HeroImageError("EVENT_NOT_MUTABLE");
    return data;
  }

  async function discardIfUnreferenced(eventId: string, path: string) {
    const { data, error: lookupError } = await storage
      .from("events")
      .select("hero_image_storage_path")
      .eq("id", eventId)
      .maybeSingle();
    if (lookupError) {
      logger.log("warn", {
        operation: "heroImageCleanup",
        eventId,
        errorCode: "referenceLookupFailed",
      });
      return;
    }
    if (data?.hero_image_storage_path === path) return;
    const { error } = await bucket.remove([path]);
    if (error)
      logger.log("warn", {
        operation: "heroImageCleanup",
        eventId,
        errorCode: "storageRemoveFailed",
      });
  }

  return {
    async prepareHeroImageUpload(input: {
      eventId: string;
      fileName: string;
      contentType: string;
    }) {
      await ownedEvent(input.eventId, true);
      const extension = heroImageExtension(input.contentType);
      if (!extension || !input.fileName.trim() || input.fileName.length > 255) {
        throw new HeroImageError("INVALID_IMAGE");
      }
      const path = `${input.eventId}/${randomUUID()}.${extension}`;
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error || !data) throw new HeroImageError("IMAGE_STORAGE_ERROR");
      return { storagePath: path, uploadToken: data.token };
    },

    async setHeroImageReference(input: {
      eventId: string;
      storagePath: string;
    }) {
      const event = await ownedEvent(input.eventId, true);
      const path = input.storagePath;
      if (
        !isEventHeroImagePath(input.eventId, path) ||
        path === event.hero_image_storage_path
      ) {
        throw new HeroImageError("INVALID_IMAGE");
      }
      const extension = path.slice(path.lastIndexOf(".") + 1);
      const info = await bucket.info(path);
      const contentType = info.data?.contentType;
      const validMetadata =
        !info.error &&
        info.data &&
        info.data.size !== undefined &&
        info.data.size > 0 &&
        info.data.size <= HERO_IMAGE_MAX_BYTES &&
        heroImageExtension(contentType ?? "") === extension;
      if (!validMetadata) {
        await discardIfUnreferenced(input.eventId, path);
        throw new HeroImageError("INVALID_IMAGE");
      }
      const downloaded = await bucket.download(path);
      if (
        downloaded.error ||
        !downloaded.data ||
        downloaded.data.size !== info.data.size ||
        downloaded.data.size > HERO_IMAGE_MAX_BYTES ||
        downloaded.data.type !== contentType ||
        !matchesHeroImageSignature(
          new Uint8Array(await downloaded.data.slice(0, 12).arrayBuffer()),
          contentType as HeroImageType,
        )
      ) {
        await discardIfUnreferenced(input.eventId, path);
        throw new HeroImageError("INVALID_IMAGE");
      }
      const { error } = await storage.rpc("set_hero_image_reference", {
        p_event_id: input.eventId,
        p_owner_user_id: organizerId,
        p_expected_previous_path: event.hero_image_storage_path,
        p_storage_path: path,
      });
      if (error) {
        await discardIfUnreferenced(input.eventId, path);
        throw new HeroImageError(
          error.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : error.message === "Hero Image changed"
              ? "IMAGE_CHANGED"
              : "IMAGE_STORAGE_ERROR",
        );
      }
      if (event.hero_image_storage_path) {
        await discardIfUnreferenced(
          input.eventId,
          event.hero_image_storage_path,
        );
      }
    },

    async removeHeroImage(eventId: string) {
      const event = await ownedEvent(eventId, true);
      if (!event.hero_image_storage_path) return;
      const { error } = await storage.rpc("set_hero_image_reference", {
        p_event_id: eventId,
        p_owner_user_id: organizerId,
        p_expected_previous_path: event.hero_image_storage_path,
        p_storage_path: null,
      });
      if (error)
        throw new HeroImageError(
          error.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : error.message === "Hero Image changed"
              ? "IMAGE_CHANGED"
              : "IMAGE_STORAGE_ERROR",
        );
      await discardIfUnreferenced(eventId, event.hero_image_storage_path);
    },

    async getAdminHeroImageSignedUrl(eventId: string): Promise<string | null> {
      const event = await ownedEvent(eventId, false);
      if (!event.hero_image_storage_path) return null;
      try {
        const { data, error } = await bucket.createSignedUrl(
          event.hero_image_storage_path,
          HERO_IMAGE_SIGNED_READ_SECONDS,
        );
        return error ? null : data.signedUrl;
      } catch {
        return null;
      }
    },
  };
}

async function organizerOperations() {
  const session = await resolveOrganizerSession();
  if (!session) throw new HeroImageError("AUTH_REQUIRED");
  const { client, user } = await createAuthenticatedSupabaseClient(
    session.accessToken,
  );
  return createHeroImageOperations({
    client,
    storage: createServiceRoleSupabaseClient(),
    organizerId: user.id,
    clock: productionClock,
  });
}

export async function prepareHeroImageUpload(input: {
  eventId: string;
  fileName: string;
  contentType: string;
}) {
  return (await organizerOperations()).prepareHeroImageUpload(input);
}
export async function setHeroImageReference(input: {
  eventId: string;
  storagePath: string;
}) {
  return (await organizerOperations()).setHeroImageReference(input);
}
export async function removeHeroImage(eventId: string) {
  return (await organizerOperations()).removeHeroImage(eventId);
}
export async function getAdminHeroImageSignedUrl(eventId: string) {
  return (await organizerOperations()).getAdminHeroImageSignedUrl(eventId);
}
