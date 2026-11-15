import { describe, expect, it } from "vitest";
import { createEventOperations } from "@/modules/events/service";
import {
  createPublicEventManager,
  createPublicEventReader,
  getPublicCover,
} from "@/modules/public-event/service";
import { PUBLIC_COVER_BUCKET } from "@/modules/public-event/validation";
import {
  anonymousClient,
  cleanupOrganizers,
  createDraftEvent,
  createOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

const at = (value: string) => ({ now: () => new Date(value) });

function publicManager(owner: Awaited<ReturnType<typeof createOrganizer>>) {
  return createPublicEventManager({
    client: owner.client,
    privilegedClient: serviceClient(),
    organizerId: owner.id,
    clock: at("2026-10-19T12:00:00Z"),
  });
}

async function syntheticCover(
  eventId: string,
  owner: Awaited<ReturnType<typeof createOrganizer>>,
) {
  const prepared = await publicManager(owner).prepareCoverUpload({
    eventId,
    fileName: "cover.png",
    contentType: "image/png",
  });
  const uploaded = await anonymousClient()
    .storage.from(PUBLIC_COVER_BUCKET)
    .uploadToSignedUrl(
      prepared.storagePath,
      prepared.uploadToken,
      new Blob(
        [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
        {
          type: "image/png",
        },
      ),
      { contentType: "image/png" },
    );
  if (uploaded.error) throw uploaded.error;
  return prepared.storagePath;
}

describe("D-29/D-30 public Event boundary", () => {
  it("defaults off, allows only the Owner to enable, and exposes only approved fields", async () => {
    const owner = await createOrganizer();
    const other = await createOrganizer();
    const service = serviceClient();
    const eventId = await createDraftEvent(owner, {
      owner_user_id: owner.id,
      event_type: "wedding",
      event_title: "Public celebration",
      host_display_names: ["Host One", "Host Two"],
      event_date: "2099-11-29",
      start_time: "18:00",
      end_time: "22:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "PUBLIC VENUE",
      venue_address: "PUBLIC ADDRESS",
      venue_map_url: "https://example.test/private-map",
      venue_arrival_notes: "PRIVATE ARRIVAL NOTES",
      invitation_message: "PRIVATE INVITATION MESSAGE",
      dress_code: "PRIVATE DRESS CODE",
      organizer_contact_information: "PRIVATE CONTACT",
    });
    try {
      const event = await service
        .from("events")
        .select("public_page_id,public_page_enabled")
        .eq("id", eventId)
        .single();
      if (event.error || !event.data) throw event.error;
      expect(event.data.public_page_enabled).toBe(false);
      const publicId = event.data.public_page_id;
      const reader = createPublicEventReader({
        client: service,
        clock: at("2026-10-19T12:00:00Z"),
      });
      expect(await reader.getView(publicId)).toBeNull();
      const ownerManager = publicManager(owner);
      await expect(
        ownerManager.saveSettings({
          eventId,
          enabled: true,
          announcement: "Join us",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_PUBLISHED" });
      await expect(
        publicManager(other).saveSettings({
          eventId,
          enabled: false,
          announcement: "wrong",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      const forged = await other.client.rpc("set_public_event_page", {
        p_event_id: eventId,
        p_owner_user_id: owner.id,
        p_enabled: true,
        p_announcement: "forged",
      });
      expect(forged.error).not.toBeNull();
      const directUpdate = await owner.client
        .from("events")
        .update({ public_page_enabled: true })
        .eq("id", eventId);
      expect(directUpdate.error).not.toBeNull();
      expect(
        (
          await anonymousClient()
            .from("events")
            .select("*")
            .eq("public_page_id", publicId)
        ).error,
      ).not.toBeNull();

      const published = await owner.client.rpc("publish_event", {
        p_event_id: eventId,
      });
      expect(published.error).toBeNull();
      await ownerManager.saveSettings({
        eventId,
        enabled: true,
        announcement: "Public hello",
      });
      const view = await reader.getView(publicId);
      expect(view).toEqual({
        publicPageId: publicId,
        eventTitle: "Public celebration",
        hostDisplayNames: ["Host One", "Host Two"],
        eventDate: "2099-11-29",
        startTime: "18:00:00",
        endTime: "22:00:00",
        eventTimezone: "Asia/Bangkok",
        venueName: "PUBLIC VENUE",
        venueAddress: "PUBLIC ADDRESS",
        announcement: "Public hello",
        hasCover: false,
      });
      const serialized = JSON.stringify(view);
      for (const secret of [
        "private-map",
        "PRIVATE ARRIVAL NOTES",
        "PRIVATE INVITATION MESSAGE",
        "PRIVATE DRESS CODE",
        "PRIVATE CONTACT",
      ])
        expect(serialized).not.toContain(secret);
      expect(
        await createPublicEventReader({
          client: service,
          clock: at("2100-01-01T00:00:00Z"),
        }).getView(publicId),
      ).toBeNull();
      await ownerManager.saveSettings({
        eventId,
        enabled: false,
        announcement: "Public hello",
      });
      expect(await reader.getView(publicId)).toBeNull();
    } finally {
      await cleanupOrganizers([owner, other]);
    }
  });

  it("serves a separate validated cover only while enabled and cleans it on deletion", async () => {
    const owner = await createOrganizer();
    const service = serviceClient();
    const eventId = await createDraftEvent(owner, {
      owner_user_id: owner.id,
      event_type: "wedding",
      event_title: "Cover fixture",
      host_display_names: ["Hosts"],
      event_date: "2099-01-01",
      start_time: "18:00",
      end_time: "22:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Private venue",
      venue_address: "Private address",
    });
    const paths: string[] = [];
    try {
      const manager = publicManager(owner);
      const path = await syntheticCover(eventId, owner);
      paths.push(path);
      await manager.setCoverReference({ eventId, storagePath: path });
      const published = await owner.client.rpc("publish_event", {
        p_event_id: eventId,
      });
      expect(published.error).toBeNull();
      const event = await service
        .from("events")
        .select("public_page_id")
        .eq("id", eventId)
        .single();
      if (event.error || !event.data) throw event.error;
      const publicId = event.data.public_page_id;
      expect(
        await getPublicCover(publicId, service, at("2026-10-19T12:00:00Z")),
      ).toBeNull();
      await manager.saveSettings({ eventId, enabled: true, announcement: "" });
      const cover = await getPublicCover(
        publicId,
        service,
        at("2026-10-19T12:00:00Z"),
      );
      expect(cover?.type).toBe("image/png");
      expect(
        (
          await anonymousClient()
            .storage.from(PUBLIC_COVER_BUCKET)
            .download(path)
        ).error,
      ).not.toBeNull();
      await manager.saveSettings({ eventId, enabled: false, announcement: "" });
      expect(
        await getPublicCover(publicId, service, at("2026-10-19T12:00:00Z")),
      ).toBeNull();
      await manager.removeCover(eventId);
      expect(
        (await service.storage.from(PUBLIC_COVER_BUCKET).info(path)).error,
      ).not.toBeNull();

      const deletionEventId = await createDraftEvent(owner);
      const deletionPath = await syntheticCover(deletionEventId, owner);
      paths.push(deletionPath);
      await manager.setCoverReference({
        eventId: deletionEventId,
        storagePath: deletionPath,
      });
      const ops = createEventOperations({
        client: owner.client,
        privilegedClient: service,
        organizerId: owner.id,
        clock: at("2026-10-19T12:00:00Z"),
      });
      expect(await ops.deleteEvent(deletionEventId)).toEqual({
        deletedEventId: deletionEventId,
      });
      expect(
        (await service.storage.from(PUBLIC_COVER_BUCKET).info(deletionPath))
          .error,
      ).not.toBeNull();
    } finally {
      if (paths.length)
        await service.storage.from(PUBLIC_COVER_BUCKET).remove(paths);
      await cleanupOrganizers([owner]);
    }
  });
});
