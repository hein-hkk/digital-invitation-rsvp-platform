import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createEventOperations } from "@/modules/events/service";
import { createGuestAccessService } from "@/modules/guest-access/service";
import { createGuestRsvpOperations } from "@/modules/rsvp/guest-service";
import { HERO_IMAGE_BUCKET } from "@/modules/hero-image/validation";
import { logger } from "@/server/observability/logger";
import {
  createInvitationCredential,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import { cleanupHeroImageOrphans } from "../../scripts/cleanup-hero-image-orphans.mjs";
import {
  cleanupOrganizers,
  createDraftEvent,
  createInvitation,
  createOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

const at = (value: string) => ({ now: () => new Date(value) });
const tokenConfig: InvitationTokenConfig = {
  hashKey: randomBytes(32),
  encryptionKey: randomBytes(32),
  keyVersion: 1,
  baseUrl: "https://example.test",
};

async function uploadHero(eventId: string) {
  const path = `${eventId}/${randomUUID()}.png`;
  const service = serviceClient();
  const uploaded = await service.storage.from(HERO_IMAGE_BUCKET).upload(
    path,
    new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], {
      type: "image/png",
    }),
    { contentType: "image/png" },
  );
  if (uploaded.error) throw uploaded.error;
  return path;
}

async function clearHero(eventId: string) {
  const bucket = serviceClient().storage.from(HERO_IMAGE_BUCKET);
  const listed = await bucket.list(eventId);
  if (listed.data?.length) {
    const removed = await bucket.remove(
      listed.data.map((file) => `${eventId}/${file.name}`),
    );
    if (removed.error) throw removed.error;
  }
}

describe("M13 permanent Event deletion", () => {
  it("deletes an owned Draft, cascades dependents, cleans Hero Image, and returns safe not-found on retry", async () => {
    const owner = await createOrganizer();
    const other = await createOrganizer();
    const service = serviceClient();
    const eventId = await createDraftEvent(owner);
    try {
      const invitationId = await createInvitation(
        owner,
        eventId,
        `Draft ${randomUUID()}`,
      );
      const path = await uploadHero(eventId);
      const pending = await cleanupHeroImageOrphans({
        client: service,
        onlyEventIds: [eventId],
        dryRun: true,
      });
      expect(pending.candidates).toBe(0);
      expect(pending.skippedRecent).toBe(1);
      const reference = await service.rpc("set_hero_image_reference", {
        p_event_id: eventId,
        p_owner_user_id: owner.id,
        p_expected_previous_path: null,
        p_storage_path: path,
      });
      expect(reference.error).toBeNull();
      const wrongOwner = createEventOperations({
        client: other.client,
        privilegedClient: service,
        organizerId: other.id,
        clock: at("2026-10-20T00:00:00Z"),
      });
      await expect(wrongOwner.deleteEvent(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
      const browserRpc = await owner.client.rpc("delete_event_record", {
        p_event_id: eventId,
        p_owner_user_id: owner.id,
      });
      expect(browserRpc.error).not.toBeNull();
      const forgedRpc = await service.rpc("delete_event_record", {
        p_event_id: eventId,
        p_owner_user_id: other.id,
      });
      expect(forgedRpc.error).not.toBeNull();

      const ops = createEventOperations({
        client: owner.client,
        privilegedClient: service,
        organizerId: owner.id,
        clock: at("2026-10-20T00:00:00Z"),
      });
      expect(await ops.deleteEvent(eventId)).toEqual({
        deletedEventId: eventId,
      });
      for (const table of [
        "events",
        "invitations",
        "rsvps",
        "invitation_access_credentials",
      ] as const) {
        const query =
          table === "events"
            ? service.from(table).select("*").eq("id", eventId)
            : table === "invitations"
              ? service.from(table).select("*").eq("id", invitationId)
              : service
                  .from(table)
                  .select("*")
                  .eq("invitation_id", invitationId);
        const result = await query;
        expect(result.data).toEqual([]);
      }
      expect(
        (await service.storage.from(HERO_IMAGE_BUCKET).info(path)).error,
      ).not.toBeNull();
      await expect(ops.deleteEvent(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
    } finally {
      await clearHero(eventId);
      await cleanupOrganizers([owner, other]);
    }
  });

  it("allows Ended deletion while former Guest read and write become unavailable", async () => {
    const owner = await createOrganizer();
    const service = serviceClient();
    const eventId = await createDraftEvent(owner, {
      owner_user_id: owner.id,
      event_type: "wedding",
      event_title: "Ended synthetic Event",
      host_display_names: ["Host"],
      event_date: "2000-01-01",
      start_time: "18:00",
      end_time: "22:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Venue",
      venue_address: "Address",
    });
    try {
      const credential = createInvitationCredential(tokenConfig);
      const invitation = await service.rpc("create_invitation_record", {
        p_owner_user_id: owner.id,
        p_event_id: eventId,
        p_invitee_name: "Former Guest",
        p_maximum_party_size: 2,
        p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
        p_token_ciphertext: credential.ciphertext,
        p_token_key_version: credential.keyVersion,
      });
      if (invitation.error) throw invitation.error;
      const published = await owner.client.rpc("publish_event", {
        p_event_id: eventId,
      });
      expect(published.error).toBeNull();
      const guest = createGuestAccessService({
        client: service,
        clock: at("2000-01-01T10:00:00Z"),
        tokenConfig,
      });
      expect((await guest.resolveGuestInvitation(credential.rawToken)).ok).toBe(
        true,
      );
      const ops = createEventOperations({
        client: owner.client,
        privilegedClient: service,
        organizerId: owner.id,
        clock: at("2026-10-20T00:00:00Z"),
      });
      const rsvp = createGuestRsvpOperations({
        client: service,
        tokenConfig,
        observedAt: () => new Date("2000-01-01T10:00:00Z"),
      });
      const [deletion] = await Promise.allSettled([
        ops.deleteEvent(eventId),
        rsvp.submitGuestRsvp(credential.rawToken, {
          status: "attending",
          attendeeCount: 1,
        }),
      ]);
      expect(deletion).toMatchObject({
        status: "fulfilled",
        value: { deletedEventId: eventId },
      });
      expect(
        await guest.resolveGuestInvitation(credential.rawToken),
      ).toMatchObject({ ok: false });
      await expect(
        rsvp.submitGuestRsvp(credential.rawToken, {
          status: "attending",
          attendeeCount: 1,
        }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      expect(
        (
          await service
            .from("invitations")
            .select("id")
            .eq("id", invitation.data!)
        ).data,
      ).toEqual([]);
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("rejects active Published deletion and preserves its database records", async () => {
    const owner = await createOrganizer();
    const service = serviceClient();
    const eventId = await createDraftEvent(owner, {
      owner_user_id: owner.id,
      event_type: "wedding",
      event_title: "Active synthetic Event",
      host_display_names: ["Host"],
      event_date: "2099-11-29",
      start_time: "18:00",
      end_time: "22:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Venue",
      venue_address: "Address",
    });
    try {
      const published = await owner.client.rpc("publish_event", {
        p_event_id: eventId,
      });
      expect(published.error).toBeNull();
      const ops = createEventOperations({
        client: owner.client,
        privilegedClient: service,
        organizerId: owner.id,
        clock: at("2026-10-20T00:00:00Z"),
      });
      await expect(ops.deleteEvent(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_DELETABLE",
      });
      const staleClockOps = createEventOperations({
        client: owner.client,
        privilegedClient: service,
        organizerId: owner.id,
        clock: at("2100-01-01T00:00:00Z"),
      });
      await expect(staleClockOps.deleteEvent(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_DELETABLE",
      });
      const bypass = await service.rpc("delete_event_record", {
        p_event_id: eventId,
        p_owner_user_id: owner.id,
      });
      expect(bypass.error?.message).toBe(
        "Active Published Event cannot be deleted",
      );
      expect(
        (await service.from("events").select("id").eq("id", eventId)).data,
      ).toHaveLength(1);
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("commits database deletion when Storage cleanup fails, then removes the private orphan", async () => {
    const owner = await createOrganizer();
    const service = serviceClient();
    const eventId = await createDraftEvent(owner);
    const log = vi.spyOn(logger, "log").mockImplementation(() => {});
    try {
      const path = await uploadHero(eventId);
      const reference = await service.rpc("set_hero_image_reference", {
        p_event_id: eventId,
        p_owner_user_id: owner.id,
        p_expected_previous_path: null,
        p_storage_path: path,
      });
      expect(reference.error).toBeNull();
      const beforeDelete = await cleanupHeroImageOrphans({
        client: service,
        onlyEventIds: [eventId],
        minimumAgeMs: 0,
        now: new Date(Date.now() + 60_000),
        dryRun: true,
      });
      expect(beforeDelete.candidates).toBe(0);
      const ops = createEventOperations({
        client: owner.client,
        privilegedClient: service,
        organizerId: owner.id,
        clock: at("2026-10-20T00:00:00Z"),
        removeHeroImageObject: async () => {
          throw new Error("synthetic Storage failure");
        },
      });
      expect(await ops.deleteEvent(eventId)).toEqual({
        deletedEventId: eventId,
      });
      expect(
        (await service.from("events").select("id").eq("id", eventId)).data,
      ).toEqual([]);
      expect(
        (await service.storage.from(HERO_IMAGE_BUCKET).info(path)).error,
      ).toBeNull();
      expect(log).toHaveBeenCalledWith("warn", {
        operation: "eventDeleteHeroCleanup",
        eventId,
        errorCode: "storageRemoveFailed",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        "synthetic Storage failure",
      );
      const options = {
        client: service,
        onlyEventIds: [eventId],
        minimumAgeMs: 0,
        now: new Date(Date.now() + 60_000),
      };
      const dryRun = await cleanupHeroImageOrphans({
        ...options,
        dryRun: true,
      });
      expect(dryRun.candidates).toBe(1);
      expect(dryRun.removed).toBe(0);
      const cleaned = await cleanupHeroImageOrphans({
        ...options,
        dryRun: false,
      });
      expect(cleaned.removed).toBe(1);
      expect(
        (await service.storage.from(HERO_IMAGE_BUCKET).info(path)).error,
      ).not.toBeNull();
    } finally {
      log.mockRestore();
      await clearHero(eventId);
      await cleanupOrganizers([owner]);
    }
  });
});
