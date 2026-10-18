import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGuestAccessService } from "@/modules/guest-access/service";
import { createInvitationOperations } from "@/modules/invitations/service";
import {
  tokenLookupHash,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import { productionClock } from "@/server/time/clock";
import {
  anonymousClient,
  cleanupOrganizers,
  createOrganizer,
  serviceClient,
  type OrganizerFixture,
} from "../helpers/local-supabase";

const tokenConfig: InvitationTokenConfig = {
  hashKey: randomBytes(32),
  encryptionKey: randomBytes(32),
  keyVersion: 1,
  baseUrl: "https://example.test",
};

function operations(organizer: OrganizerFixture) {
  return createInvitationOperations({
    client: organizer.client,
    credentialClient: serviceClient(),
    organizerId: organizer.id,
    clock: productionClock,
    tokenConfig,
  });
}

function rawToken(url: string) {
  return url.split("/").at(-1)!;
}

function guest() {
  return createGuestAccessService({
    client: serviceClient(),
    clock: productionClock,
    tokenConfig,
  });
}

async function publishedEvent(organizerId: string) {
  const result = await serviceClient()
    .from("events")
    .insert({
      owner_user_id: organizerId,
      publication_status: "published",
      published_at: new Date().toISOString(),
      event_type: "wedding",
      event_title: "Synthetic Access Event",
      host_display_names: ["Synthetic Host"],
      event_date: "2099-11-29",
      start_time: "18:00",
      end_time: "21:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Synthetic Venue",
      venue_address: "Synthetic Address",
    })
    .select("id")
    .single();
  if (result.error || !result.data) throw result.error;
  return result.data.id;
}

describe("M10 Invitation access management against local Supabase", () => {
  it("regenerates one current link, invalidates the old link, and preserves RSVP and Invitation data", async () => {
    const owner = await createOrganizer();
    try {
      const eventId = await publishedEvent(owner.id);
      const service = operations(owner);
      const created = await service.createInvitation(eventId, {
        inviteeName: "Synthetic Household",
        maximumPartySize: "3",
      });
      const savedRsvp = await serviceClient()
        .from("rsvps")
        .update({
          status: "attending",
          attendee_count: 2,
          attendee_names: ["A", "B"],
        })
        .eq("invitation_id", created.invitationId)
        .select("*")
        .single();
      expect(savedRsvp.error).toBeNull();

      const rotated = await service.regenerateInvitationToken(
        eventId,
        created.invitationId,
      );
      expect(rotated.currentInvitationUrl).not.toBe(
        created.currentInvitationUrl,
      );
      expect(new Date(rotated.tokenCreatedAt).getTime()).toBeGreaterThan(0);
      expect(
        await guest().resolveGuestInvitation(
          rawToken(created.currentInvitationUrl),
        ),
      ).toMatchObject({ ok: false });
      expect(
        await guest().resolveGuestInvitation(
          rawToken(rotated.currentInvitationUrl),
        ),
      ).toMatchObject({
        ok: true,
        value: {
          inviteeName: "Synthetic Household",
          rsvp: { status: "attending", attendeeCount: 2 },
        },
      });
      const detail = await service.getInvitationAdminDetail(
        eventId,
        created.invitationId,
      );
      expect(detail.currentInvitationUrl).toBe(rotated.currentInvitationUrl);
      expect(detail.invitation.maximum_party_size).toBe(3);
      expect(detail.rsvp).toEqual(savedRsvp.data);
      const credentials = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_created_at")
        .eq("invitation_id", created.invitationId);
      expect(credentials.data).toHaveLength(1);
      expect(credentials.data?.[0].token_created_at).toBe(
        rotated.tokenCreatedAt,
      );
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("serializes simultaneous regenerations; only the final committed Token works", async () => {
    const owner = await createOrganizer();
    try {
      const eventId = await publishedEvent(owner.id);
      const service = operations(owner);
      const created = await service.createInvitation(eventId, {
        inviteeName: "Concurrent Household",
        maximumPartySize: "2",
      });
      const [first, second] = await Promise.all([
        service.regenerateInvitationToken(eventId, created.invitationId),
        service.regenerateInvitationToken(eventId, created.invitationId),
      ]);
      expect(first.currentInvitationUrl).not.toBe(second.currentInvitationUrl);
      const current = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_lookup_hash")
        .eq("invitation_id", created.invitationId);
      expect(current.data).toHaveLength(1);
      const currentHash = current.data![0].token_lookup_hash;
      const candidates = [first, second];
      const winner = candidates.find(
        ({ currentInvitationUrl }) =>
          `\\x${tokenLookupHash(rawToken(currentInvitationUrl), tokenConfig).toString("hex")}` ===
          currentHash,
      );
      expect(winner).toBeDefined();
      for (const candidate of candidates) {
        expect(
          await guest().resolveGuestInvitation(
            rawToken(candidate.currentInvitationUrl),
          ),
        ).toMatchObject({
          ok: candidate === winner,
        });
      }
      expect(
        await guest().resolveGuestInvitation(
          rawToken(created.currentInvitationUrl),
        ),
      ).toMatchObject({ ok: false });
      const rsvp = await serviceClient()
        .from("rsvps")
        .select("status")
        .eq("invitation_id", created.invitationId);
      expect(rsvp.data).toEqual([{ status: "awaiting_response" }]);
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("retains the current link when a replacement transaction fails", async () => {
    const owner = await createOrganizer();
    try {
      const eventId = await publishedEvent(owner.id);
      const service = operations(owner);
      const first = await service.createInvitation(eventId, {
        inviteeName: "First Household",
        maximumPartySize: "2",
      });
      const second = await service.createInvitation(eventId, {
        inviteeName: "Second Household",
        maximumPartySize: "2",
      });
      const conflicting = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_lookup_hash")
        .eq("invitation_id", second.invitationId)
        .single();
      expect(conflicting.error).toBeNull();
      const failed = await serviceClient().rpc(
        "replace_invitation_credential",
        {
          p_owner_user_id: owner.id,
          p_invitation_id: first.invitationId,
          p_token_lookup_hash: conflicting.data!.token_lookup_hash,
          p_token_ciphertext: "synthetic-failed-envelope",
          p_token_key_version: 1,
        },
      );
      expect(failed.error).not.toBeNull();
      expect(
        (await service.getInvitationAdminDetail(eventId, first.invitationId))
          .currentInvitationUrl,
      ).toBe(first.currentInvitationUrl);
      expect(
        await guest().resolveGuestInvitation(
          rawToken(first.currentInvitationUrl),
        ),
      ).toMatchObject({ ok: true });
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("revokes access without replacing the Token or deleting RSVP, and cannot regenerate afterward", async () => {
    const owner = await createOrganizer();
    try {
      const eventId = await publishedEvent(owner.id);
      const service = operations(owner);
      const created = await service.createInvitation(eventId, {
        inviteeName: "Revoked Household",
        maximumPartySize: "2",
      });
      const before = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_lookup_hash,token_created_at")
        .eq("invitation_id", created.invitationId)
        .single();
      expect(before.error).toBeNull();
      const result = await service.revokeInvitation(
        eventId,
        created.invitationId,
      );
      expect(result.accessState).toBe("revoked");
      expect(new Date(result.revokedAt).getTime()).toBeGreaterThan(0);
      const detail = await service.getInvitationAdminDetail(
        eventId,
        created.invitationId,
      );
      expect(detail.accessState).toBe("revoked");
      expect(detail.currentInvitationUrl).toBeNull();
      expect(detail.invitation.invitee_name).toBe("Revoked Household");
      expect(detail.invitation.revoked_at).toBe(result.revokedAt);
      expect(detail.rsvp.status).toBe("awaiting_response");
      expect(
        await guest().resolveGuestInvitation(
          rawToken(created.currentInvitationUrl),
        ),
      ).toMatchObject({ ok: false });
      const after = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_lookup_hash,token_created_at")
        .eq("invitation_id", created.invitationId)
        .single();
      expect(after.data).toEqual(before.data);
      await expect(
        service.regenerateInvitationToken(eventId, created.invitationId),
      ).rejects.toMatchObject({ code: "INVITATION_REVOKED" });
      await expect(
        service.revokeInvitation(eventId, created.invitationId),
      ).rejects.toMatchObject({ code: "INVITATION_REVOKED" });
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("enforces owner, parent Event, anonymous access, and Ended read-only boundaries", async () => {
    const owner = await createOrganizer();
    const stranger = await createOrganizer();
    try {
      const eventId = await publishedEvent(owner.id);
      const otherEventId = await publishedEvent(stranger.id);
      const owned = operations(owner);
      const foreign = operations(stranger);
      const created = await owned.createInvitation(eventId, {
        inviteeName: "Private Household",
        maximumPartySize: "2",
      });
      await expect(
        foreign.regenerateInvitationToken(eventId, created.invitationId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      await expect(
        foreign.revokeInvitation(eventId, created.invitationId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      await expect(
        foreign.regenerateInvitationToken(otherEventId, created.invitationId),
      ).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
      await expect(
        foreign.revokeInvitation(otherEventId, created.invitationId),
      ).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
      expect(
        (
          await anonymousClient().rpc("revoke_invitation_record", {
            p_event_id: eventId,
            p_invitation_id: created.invitationId,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await owner.client.rpc("replace_invitation_credential", {
            p_owner_user_id: owner.id,
            p_invitation_id: created.invitationId,
            p_token_lookup_hash: `\\x${"ab".repeat(32)}`,
            p_token_ciphertext: "synthetic-envelope",
            p_token_key_version: 1,
          })
        ).error,
      ).not.toBeNull();
      const ended = await serviceClient()
        .from("events")
        .update({ event_date: "2000-01-01" })
        .eq("id", eventId);
      expect(ended.error).toBeNull();
      await expect(
        owned.regenerateInvitationToken(eventId, created.invitationId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
      await expect(
        owned.revokeInvitation(eventId, created.invitationId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
      expect(
        (
          await serviceClient().rpc("replace_invitation_credential", {
            p_owner_user_id: owner.id,
            p_invitation_id: created.invitationId,
            p_token_lookup_hash: `\\x${"cd".repeat(32)}`,
            p_token_ciphertext: "synthetic-envelope",
            p_token_key_version: 1,
          })
        ).error?.message,
      ).toBe("EVENT_NOT_MUTABLE");
    } finally {
      await cleanupOrganizers([owner, stranger]);
    }
  });
});
