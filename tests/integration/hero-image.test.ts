import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGuestAccessService } from "@/modules/guest-access/service";
import {
  createHeroImageOperations,
  HeroImageError,
} from "@/modules/hero-image/service";
import {
  HERO_IMAGE_BUCKET,
  HERO_IMAGE_MAX_BYTES,
} from "@/modules/hero-image/validation";
import {
  createInvitationCredential,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import {
  anonymousClient,
  cleanupOrganizers,
  createDraftEvent,
  createOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

const signatures = {
  "image/jpeg": Uint8Array.from([255, 216, 255, 217]),
  "image/png": Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
  "image/webp": Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
} as const;
const at = (value: string) => ({ now: () => new Date(value) });

async function clearObjects(eventIds: string[]) {
  const bucket = serviceClient().storage.from(HERO_IMAGE_BUCKET);
  for (const eventId of eventIds) {
    const listed = await bucket.list(eventId, { limit: 100 });
    if (listed.data?.length) {
      const removed = await bucket.remove(
        listed.data.map((file) => `${eventId}/${file.name}`),
      );
      if (removed.error) throw removed.error;
    }
  }
}

describe("M12 private Hero Image", () => {
  it("uploads, verifies, replaces, removes, and privately serves approved raster images", async () => {
    const organizer = await createOrganizer();
    const service = serviceClient();
    const eventIds: string[] = [];
    try {
      const eventId = await createDraftEvent(organizer);
      eventIds.push(eventId);
      const ops = createHeroImageOperations({
        client: organizer.client,
        storage: service,
        organizerId: organizer.id,
        clock: at("2026-10-19T00:00:00Z"),
      });
      let priorPath: string | null = null;
      for (const [contentType, bytes] of Object.entries(signatures)) {
        const prepared = await ops.prepareHeroImageUpload({
          eventId,
          fileName: "sample",
          contentType,
        });
        const uploaded = await anonymousClient()
          .storage.from(HERO_IMAGE_BUCKET)
          .uploadToSignedUrl(
            prepared.storagePath,
            prepared.uploadToken,
            new Blob([bytes], { type: contentType }),
            { contentType },
          );
        expect(uploaded.error).toBeNull();
        await ops.setHeroImageReference({
          eventId,
          storagePath: prepared.storagePath,
        });
        const current = await service
          .from("events")
          .select("hero_image_storage_path")
          .eq("id", eventId)
          .single();
        expect(current.data?.hero_image_storage_path).toBe(
          prepared.storagePath,
        );
        const unsigned = await anonymousClient()
          .storage.from(HERO_IMAGE_BUCKET)
          .download(prepared.storagePath);
        expect(unsigned.error).not.toBeNull();
        expect(await ops.getAdminHeroImageSignedUrl(eventId)).toContain(
          "token=",
        );
        if (priorPath) {
          const old = await service.storage
            .from(HERO_IMAGE_BUCKET)
            .info(priorPath);
          expect(old.error).not.toBeNull();
        }
        priorPath = prepared.storagePath;
      }
      await ops.removeHeroImage(eventId);
      expect(
        (
          await service
            .from("events")
            .select("hero_image_storage_path")
            .eq("id", eventId)
            .single()
        ).data?.hero_image_storage_path,
      ).toBeNull();
      expect(
        (await service.storage.from(HERO_IMAGE_BUCKET).info(priorPath!)).error,
      ).not.toBeNull();
    } finally {
      await clearObjects(eventIds);
      await cleanupOrganizers([organizer]);
    }
  }, 15_000);

  it("rejects SVG, spoofed bytes, oversized files, another Owner, and Ended mutations", async () => {
    const owner = await createOrganizer();
    const other = await createOrganizer();
    const service = serviceClient();
    const eventIds: string[] = [];
    try {
      const eventId = await createDraftEvent(owner);
      eventIds.push(eventId);
      const ownerOps = createHeroImageOperations({
        client: owner.client,
        storage: service,
        organizerId: owner.id,
        clock: at("2026-10-19T00:00:00Z"),
      });
      const otherOps = createHeroImageOperations({
        client: other.client,
        storage: service,
        organizerId: other.id,
        clock: at("2026-10-19T00:00:00Z"),
      });
      await expect(
        ownerOps.prepareHeroImageUpload({
          eventId,
          fileName: "script.svg",
          contentType: "image/svg+xml",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_IMAGE",
      } satisfies Partial<HeroImageError>);
      await expect(
        otherOps.prepareHeroImageUpload({
          eventId,
          fileName: "photo.png",
          contentType: "image/png",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      await expect(otherOps.removeHeroImage(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
      const directUpload = await anonymousClient()
        .storage.from(HERO_IMAGE_BUCKET)
        .upload(
          `${eventId}/untrusted.png`,
          new Blob([signatures["image/png"]], {
            type: "image/png",
          }),
        );
      expect(directUpload.error).not.toBeNull();

      const prepared = await ownerOps.prepareHeroImageUpload({
        eventId,
        fileName: "spoof.png",
        contentType: "image/png",
      });
      expect(
        (
          await anonymousClient()
            .storage.from(HERO_IMAGE_BUCKET)
            .uploadToSignedUrl(
              prepared.storagePath,
              prepared.uploadToken,
              new Blob(["<svg/>"], { type: "image/png" }),
              { contentType: "image/png" },
            )
        ).error,
      ).toBeNull();
      await expect(
        ownerOps.setHeroImageReference({
          eventId,
          storagePath: prepared.storagePath,
        }),
      ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
      expect(
        (
          await service.storage
            .from(HERO_IMAGE_BUCKET)
            .info(prepared.storagePath)
        ).error,
      ).not.toBeNull();

      const tooLarge = await ownerOps.prepareHeroImageUpload({
        eventId,
        fileName: "large.jpg",
        contentType: "image/jpeg",
      });
      const oversize = new Uint8Array(HERO_IMAGE_MAX_BYTES + 1);
      oversize.set(signatures["image/jpeg"]);
      const refused = await anonymousClient()
        .storage.from(HERO_IMAGE_BUCKET)
        .uploadToSignedUrl(
          tooLarge.storagePath,
          tooLarge.uploadToken,
          new Blob([oversize], { type: "image/jpeg" }),
          { contentType: "image/jpeg" },
        );
      expect(refused.error).not.toBeNull();

      const boundary = await ownerOps.prepareHeroImageUpload({
        eventId,
        fileName: "boundary.jpg",
        contentType: "image/jpeg",
      });
      const exactLimit = await anonymousClient()
        .storage.from(HERO_IMAGE_BUCKET)
        .uploadToSignedUrl(
          boundary.storagePath,
          boundary.uploadToken,
          new Blob([oversize.subarray(0, HERO_IMAGE_MAX_BYTES)], {
            type: "image/jpeg",
          }),
          { contentType: "image/jpeg" },
        );
      expect(exactLimit.error).toBeNull();
      await expect(
        otherOps.setHeroImageReference({
          eventId,
          storagePath: boundary.storagePath,
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      await ownerOps.setHeroImageReference({
        eventId,
        storagePath: boundary.storagePath,
      });
      await ownerOps.removeHeroImage(eventId);

      const browserRpc = await owner.client.rpc("set_hero_image_reference", {
        p_event_id: eventId,
        p_owner_user_id: owner.id,
        p_expected_previous_path: null,
        p_storage_path: prepared.storagePath,
      });
      expect(browserRpc.error).not.toBeNull();

      const endedOps = createHeroImageOperations({
        client: owner.client,
        storage: service,
        organizerId: owner.id,
        clock: at("2100-01-01T00:00:00Z"),
      });
      const published = await service
        .from("events")
        .update({
          event_type: "wedding",
          event_title: "Synthetic",
          host_display_names: ["Host"],
          event_date: "2099-11-29",
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Venue",
          venue_address: "Address",
          publication_status: "published",
          published_at: "2099-11-20T00:00:00Z",
        })
        .eq("id", eventId);
      expect(published.error).toBeNull();
      await expect(
        endedOps.prepareHeroImageUpload({
          eventId,
          fileName: "late.jpg",
          contentType: "image/jpeg",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
      await expect(endedOps.removeHeroImage(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_MUTABLE",
      });

      const past = await service
        .from("events")
        .insert({
          owner_user_id: owner.id,
          publication_status: "published",
          published_at: "2020-01-01T00:00:00Z",
          event_type: "wedding",
          event_title: "Ended Synthetic Event",
          host_display_names: ["Host"],
          event_date: "2020-01-02",
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Venue",
          venue_address: "Address",
        })
        .select("id")
        .single();
      if (past.error || !past.data) throw past.error;
      eventIds.push(past.data.id);
      await expect(
        ownerOps.prepareHeroImageUpload({
          eventId: past.data.id,
          fileName: "late.jpg",
          contentType: "image/jpeg",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
      const directEndedRpc = await service.rpc("set_hero_image_reference", {
        p_event_id: past.data.id,
        p_owner_user_id: owner.id,
        p_expected_previous_path: null,
        p_storage_path: null,
      });
      expect(directEndedRpc.error?.message).toBe("Ended Event is read-only");
    } finally {
      await clearObjects(eventIds);
      await cleanupOrganizers([owner, other]);
    }
  });

  it("issues a short-lived signed read URL only for an authorized Guest Invitation", async () => {
    const owner = await createOrganizer();
    const service = serviceClient();
    const eventIds: string[] = [];
    const tokenConfig: InvitationTokenConfig = {
      hashKey: randomBytes(32),
      encryptionKey: randomBytes(32),
      keyVersion: 1,
      baseUrl: "https://example.test",
    };
    try {
      const event = await service
        .from("events")
        .insert({
          owner_user_id: owner.id,
          publication_status: "published",
          published_at: "2099-11-20T00:00:00Z",
          event_type: "wedding",
          event_title: "Synthetic",
          host_display_names: ["Host"],
          event_date: "2099-11-29",
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Venue",
          venue_address: "Address",
        })
        .select("id")
        .single();
      if (event.error || !event.data) throw event.error;
      const eventId = event.data.id;
      eventIds.push(eventId);
      const ops = createHeroImageOperations({
        client: owner.client,
        storage: service,
        organizerId: owner.id,
        clock: at("2099-11-20T00:00:00Z"),
      });
      const prepared = await ops.prepareHeroImageUpload({
        eventId,
        fileName: "hero.png",
        contentType: "image/png",
      });
      const uploaded = await anonymousClient()
        .storage.from(HERO_IMAGE_BUCKET)
        .uploadToSignedUrl(
          prepared.storagePath,
          prepared.uploadToken,
          new Blob([signatures["image/png"]], { type: "image/png" }),
          { contentType: "image/png" },
        );
      if (uploaded.error) throw uploaded.error;
      await ops.setHeroImageReference({
        eventId,
        storagePath: prepared.storagePath,
      });

      const credential = createInvitationCredential(tokenConfig);
      const invitation = await service.rpc("create_invitation_record", {
        p_owner_user_id: owner.id,
        p_event_id: eventId,
        p_invitee_name: "Guest",
        p_maximum_party_size: 2,
        p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
        p_token_ciphertext: credential.ciphertext,
        p_token_key_version: credential.keyVersion,
      });
      if (invitation.error || !invitation.data) throw invitation.error;
      const guest = createGuestAccessService({
        client: service,
        clock: at("2099-11-20T00:00:00Z"),
        tokenConfig,
      });
      const resolved = await guest.resolveGuestInvitation(credential.rawToken);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error("Guest unavailable");
      expect(resolved.value.event.heroImageSignedUrl).toContain("token=");
      expect(
        await guest.resolveGuestInvitation(
          randomBytes(32).toString("base64url"),
        ),
      ).toMatchObject({ ok: false });
      const signedResponse = await fetch(
        resolved.value.event.heroImageSignedUrl!,
      );
      expect(signedResponse.ok).toBe(true);
      const revoked = await owner.client.rpc("revoke_invitation_record", {
        p_event_id: eventId,
        p_invitation_id: invitation.data,
      });
      expect(revoked.error).toBeNull();
      expect(
        await guest.resolveGuestInvitation(credential.rawToken),
      ).toMatchObject({ ok: false });
      const afterExpiry = createGuestAccessService({
        client: service,
        clock: at("2100-01-01T00:00:00Z"),
        tokenConfig,
      });
      expect(
        await afterExpiry.resolveGuestInvitation(credential.rawToken),
      ).toMatchObject({ ok: false });
    } finally {
      await clearObjects(eventIds);
      await cleanupOrganizers([owner]);
    }
  });
});
