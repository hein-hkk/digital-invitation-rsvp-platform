import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEventRuntimeState } from "@/modules/events/domain";
import { resolveOrganizerSession } from "@/server/auth/session";
import { logger } from "@/server/observability/logger";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import { productionClock, type Clock } from "@/server/time/clock";
import type { Database } from "@/types/database.types";
import {
  PUBLIC_COVER_BUCKET,
  PUBLIC_COVER_MAX_BYTES,
  heroImageExtension,
  isPublicCoverPath,
  matchesHeroImageSignature,
  type HeroImageType,
} from "./validation";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type PublicEventRow = Pick<
  EventRow,
  | "id"
  | "public_page_id"
  | "public_page_enabled"
  | "publication_status"
  | "event_title"
  | "host_display_names"
  | "event_date"
  | "start_time"
  | "end_time"
  | "event_timezone"
  | "venue_name"
  | "venue_address"
  | "public_announcement"
  | "public_cover_storage_path"
>;

export type PublicEventView = {
  publicPageId: string;
  eventTitle: string;
  hostDisplayNames: string[];
  eventDate: string;
  startTime: string;
  endTime: string | null;
  eventTimezone: string;
  venueName: string;
  venueAddress: string;
  announcement: string | null;
  hasCover: boolean;
};

export type PublicEventErrorCode =
  | "AUTH_REQUIRED"
  | "EVENT_NOT_FOUND"
  | "EVENT_NOT_MUTABLE"
  | "EVENT_NOT_PUBLISHED"
  | "INVALID_IMAGE"
  | "IMAGE_CHANGED"
  | "PERSISTENCE_ERROR";

export class PublicEventError extends Error {
  constructor(readonly code: PublicEventErrorCode) {
    super(code);
  }
}

const publicColumns =
  "id,public_page_id,public_page_enabled,publication_status,event_title,host_display_names,event_date,start_time,end_time,event_timezone,venue_name,venue_address,public_announcement,public_cover_storage_path";

function activePublished(event: PublicEventRow, clock: Clock): boolean {
  return (
    getEventRuntimeState(
      {
        publicationStatus: event.publication_status,
        eventDate: event.event_date,
        endTime: event.end_time,
        eventTimezone: event.event_timezone,
      },
      clock,
    ) === "published"
  );
}

function toView(event: PublicEventRow): PublicEventView | null {
  if (
    !event.event_title ||
    !event.host_display_names.length ||
    !event.event_date ||
    !event.start_time ||
    !event.event_timezone ||
    !event.venue_name ||
    !event.venue_address
  )
    return null;
  return {
    publicPageId: event.public_page_id,
    eventTitle: event.event_title,
    hostDisplayNames: event.host_display_names,
    eventDate: event.event_date,
    startTime: event.start_time,
    endTime: event.end_time,
    eventTimezone: event.event_timezone,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    announcement: event.public_announcement,
    hasCover: Boolean(event.public_cover_storage_path),
  };
}

export function createPublicEventReader(context: {
  client: SupabaseClient<Database>;
  clock: Clock;
}) {
  async function resolve(publicPageId: string) {
    if (!z.uuid().safeParse(publicPageId).success) return null;
    const { data, error } = await context.client
      .from("events")
      .select(publicColumns)
      .eq("public_page_id", publicPageId)
      .eq("public_page_enabled", true)
      .eq("publication_status", "published")
      .maybeSingle();
    if (error) throw new PublicEventError("PERSISTENCE_ERROR");
    if (!data || !activePublished(data, context.clock)) return null;
    return data;
  }
  return {
    async getView(publicPageId: string): Promise<PublicEventView | null> {
      const event = await resolve(publicPageId);
      return event ? toView(event) : null;
    },
    async getCoverPath(publicPageId: string): Promise<string | null> {
      const event = await resolve(publicPageId);
      if (!event?.public_cover_storage_path) return null;
      return isPublicCoverPath(event.id, event.public_cover_storage_path)
        ? event.public_cover_storage_path
        : null;
    },
  };
}

export async function getPublicEventView(publicPageId: string) {
  return createPublicEventReader({
    client: createServiceRoleSupabaseClient(),
    clock: productionClock,
  }).getView(publicPageId);
}

export async function getPublicCover(
  publicPageId: string,
  client = createServiceRoleSupabaseClient(),
  clock: Clock = productionClock,
) {
  const reader = createPublicEventReader({ client, clock });
  const path = await reader.getCoverPath(publicPageId);
  if (!path) return null;
  const downloaded = await client.storage
    .from(PUBLIC_COVER_BUCKET)
    .download(path);
  if (downloaded.error || !downloaded.data) return null;
  const blob = downloaded.data;
  if (
    blob.size === 0 ||
    blob.size > PUBLIC_COVER_MAX_BYTES ||
    heroImageExtension(blob.type) !== path.slice(path.lastIndexOf(".") + 1)
  )
    return null;
  return blob;
}

type ManagerContext = {
  client: SupabaseClient<Database>;
  privilegedClient: SupabaseClient<Database>;
  organizerId: string;
  clock: Clock;
};

export function createPublicEventManager(context: ManagerContext) {
  const { client, privilegedClient, organizerId, clock } = context;
  const bucket = privilegedClient.storage.from(PUBLIC_COVER_BUCKET);

  async function ownedEvent(eventId: string, mutable: boolean) {
    if (!z.uuid().safeParse(eventId).success)
      throw new PublicEventError("EVENT_NOT_FOUND");
    const { data, error } = await client
      .from("events")
      .select(publicColumns)
      .eq("id", eventId)
      .eq("owner_user_id", organizerId)
      .maybeSingle();
    if (error) throw new PublicEventError("PERSISTENCE_ERROR");
    if (!data) throw new PublicEventError("EVENT_NOT_FOUND");
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
      throw new PublicEventError("EVENT_NOT_MUTABLE");
    return data;
  }

  async function discardIfUnreferenced(eventId: string, path: string) {
    const { data, error } = await privilegedClient
      .from("events")
      .select("public_cover_storage_path")
      .eq("id", eventId)
      .maybeSingle();
    if (error) return;
    if (data?.public_cover_storage_path === path) return;
    const removed = await bucket.remove([path]);
    if (removed.error)
      logger.log("warn", {
        operation: "publicCoverCleanup",
        eventId,
        errorCode: "storageRemoveFailed",
      });
  }

  return {
    async getPreview(eventId: string) {
      const event = await ownedEvent(eventId, false);
      if (!activePublished(event, clock)) return null;
      const view = toView(event);
      if (!view) return null;
      let coverUrl: string | null = null;
      if (
        event.public_cover_storage_path &&
        isPublicCoverPath(event.id, event.public_cover_storage_path)
      ) {
        try {
          const signed = await bucket.createSignedUrl(
            event.public_cover_storage_path,
            60,
          );
          if (!signed.error) coverUrl = signed.data.signedUrl;
        } catch {
          // Preview remains available when optional Storage media is unavailable.
        }
      }
      return { view, coverUrl };
    },

    async getAdminCoverSignedUrl(eventId: string): Promise<string | null> {
      const event = await ownedEvent(eventId, false);
      if (
        !event.public_cover_storage_path ||
        !isPublicCoverPath(event.id, event.public_cover_storage_path)
      )
        return null;
      try {
        const signed = await bucket.createSignedUrl(
          event.public_cover_storage_path,
          60,
        );
        return signed.error ? null : signed.data.signedUrl;
      } catch {
        return null;
      }
    },

    async saveSettings(input: {
      eventId: string;
      enabled: boolean;
      announcement: string;
    }) {
      const event = await ownedEvent(input.eventId, true);
      if (input.enabled && !activePublished(event, clock))
        throw new PublicEventError("EVENT_NOT_PUBLISHED");
      const { error } = await privilegedClient.rpc("set_public_event_page", {
        p_event_id: input.eventId,
        p_owner_user_id: organizerId,
        p_enabled: input.enabled,
        p_announcement: input.announcement,
      });
      if (error)
        throw new PublicEventError(
          error.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : error.message === "Public page requires active Published Event"
              ? "EVENT_NOT_PUBLISHED"
              : "PERSISTENCE_ERROR",
        );
    },

    async prepareCoverUpload(input: {
      eventId: string;
      fileName: string;
      contentType: string;
    }) {
      await ownedEvent(input.eventId, true);
      const extension = heroImageExtension(input.contentType);
      if (!extension || !input.fileName.trim() || input.fileName.length > 255)
        throw new PublicEventError("INVALID_IMAGE");
      const path = `${input.eventId}/public-${randomUUID()}.${extension}`;
      const signed = await bucket.createSignedUploadUrl(path);
      if (signed.error || !signed.data)
        throw new PublicEventError("PERSISTENCE_ERROR");
      return { storagePath: path, uploadToken: signed.data.token };
    },

    async setCoverReference(input: { eventId: string; storagePath: string }) {
      const event = await ownedEvent(input.eventId, true);
      const path = input.storagePath;
      if (
        !isPublicCoverPath(input.eventId, path) ||
        path === event.public_cover_storage_path
      )
        throw new PublicEventError("INVALID_IMAGE");
      const extension = path.slice(path.lastIndexOf(".") + 1);
      const info = await bucket.info(path);
      const contentType = info.data?.contentType;
      const validMetadata =
        !info.error &&
        info.data &&
        info.data.size !== undefined &&
        info.data.size > 0 &&
        info.data.size <= PUBLIC_COVER_MAX_BYTES &&
        heroImageExtension(contentType ?? "") === extension;
      if (!validMetadata) {
        await discardIfUnreferenced(input.eventId, path);
        throw new PublicEventError("INVALID_IMAGE");
      }
      const downloaded = await bucket.download(path);
      if (
        downloaded.error ||
        !downloaded.data ||
        downloaded.data.size !== info.data.size ||
        downloaded.data.size > PUBLIC_COVER_MAX_BYTES ||
        downloaded.data.type !== contentType ||
        !matchesHeroImageSignature(
          new Uint8Array(await downloaded.data.slice(0, 12).arrayBuffer()),
          contentType as HeroImageType,
        )
      ) {
        await discardIfUnreferenced(input.eventId, path);
        throw new PublicEventError("INVALID_IMAGE");
      }
      const { error } = await privilegedClient.rpc(
        "set_public_cover_reference",
        {
          p_event_id: input.eventId,
          p_owner_user_id: organizerId,
          p_expected_previous_path: event.public_cover_storage_path,
          p_storage_path: path,
        },
      );
      if (error) {
        await discardIfUnreferenced(input.eventId, path);
        throw new PublicEventError(
          error.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : error.message === "Public cover changed"
              ? "IMAGE_CHANGED"
              : "PERSISTENCE_ERROR",
        );
      }
      if (event.public_cover_storage_path)
        await discardIfUnreferenced(
          input.eventId,
          event.public_cover_storage_path,
        );
    },

    async removeCover(eventId: string) {
      const event = await ownedEvent(eventId, true);
      if (!event.public_cover_storage_path) return;
      const { error } = await privilegedClient.rpc(
        "set_public_cover_reference",
        {
          p_event_id: eventId,
          p_owner_user_id: organizerId,
          p_expected_previous_path: event.public_cover_storage_path,
          p_storage_path: null,
        },
      );
      if (error)
        throw new PublicEventError(
          error.message === "Ended Event is read-only"
            ? "EVENT_NOT_MUTABLE"
            : error.message === "Public cover changed"
              ? "IMAGE_CHANGED"
              : "PERSISTENCE_ERROR",
        );
      await discardIfUnreferenced(eventId, event.public_cover_storage_path);
    },
  };
}

async function organizerManager() {
  const session = await resolveOrganizerSession();
  if (!session) throw new PublicEventError("AUTH_REQUIRED");
  const { client, user } = await createAuthenticatedSupabaseClient(
    session.accessToken,
  );
  return createPublicEventManager({
    client,
    privilegedClient: createServiceRoleSupabaseClient(),
    organizerId: user.id,
    clock: productionClock,
  });
}

export async function getAdminPublicPreview(eventId: string) {
  return (await organizerManager()).getPreview(eventId);
}
export async function getAdminPublicCoverSignedUrl(eventId: string) {
  return (await organizerManager()).getAdminCoverSignedUrl(eventId);
}
export async function savePublicEventSettings(input: {
  eventId: string;
  enabled: boolean;
  announcement: string;
}) {
  return (await organizerManager()).saveSettings(input);
}
export async function preparePublicCoverUpload(input: {
  eventId: string;
  fileName: string;
  contentType: string;
}) {
  return (await organizerManager()).prepareCoverUpload(input);
}
export async function setPublicCoverReference(input: {
  eventId: string;
  storagePath: string;
}) {
  return (await organizerManager()).setCoverReference(input);
}
export async function removePublicCover(eventId: string) {
  return (await organizerManager()).removeCover(eventId);
}
