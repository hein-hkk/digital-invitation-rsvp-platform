import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createInvitationOperations } from "@/modules/invitations/service";
import type { InvitationTokenConfig } from "@/server/security/invitation-credentials";
import { productionClock } from "@/server/time/clock";
import {
  cleanupOrganizers,
  createDraftEvent,
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

describe("M5 Invitation service against local Supabase", () => {
  it("atomically creates a Draft Invitation, one credential, and Awaiting Response RSVP", async () => {
    const organizer = await createOrganizer();
    try {
      const eventId = await createDraftEvent(organizer);
      const service = operations(organizer);
      const result = await service.createInvitation(eventId, {
        inviteeName: "  Synthetic Household  ",
        maximumPartySize: "3",
      });
      expect(result.currentInvitationUrl).toMatch(
        /^https:\/\/example\.test\/i\/[A-Za-z0-9_-]{43}$/,
      );
      const detail = await service.getInvitationAdminDetail(
        eventId,
        result.invitationId,
      );
      expect(detail.invitation.invitee_name).toBe("Synthetic Household");
      expect(detail.invitation.maximum_party_size).toBe(3);
      expect(detail.rsvp).toMatchObject({
        status: "awaiting_response",
        attendee_count: 0,
      });
      expect(detail.currentInvitationUrl).toBe(result.currentInvitationUrl);
      expect(detail.runtimeState).toBe("draft");
      const credentials = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_ciphertext,token_lookup_hash")
        .eq("invitation_id", result.invitationId);
      expect(credentials.data).toHaveLength(1);
      const rawToken = result.currentInvitationUrl.split("/").at(-1)!;
      expect(credentials.data?.[0].token_ciphertext).not.toContain(rawToken);
      expect(credentials.data?.[0].token_lookup_hash).toMatch(
        /^\\x[0-9a-f]{64}$/,
      );
      expect(
        (
          await serviceClient()
            .from("rsvps")
            .insert({ invitation_id: result.invitationId })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await serviceClient()
            .from("invitation_access_credentials")
            .insert({
              invitation_id: result.invitationId,
              token_lookup_hash: `\\x${"ab".repeat(32)}`,
              token_ciphertext: "duplicate-test-envelope",
              token_key_version: 1,
            })
        ).error,
      ).not.toBeNull();
      const list = await service.listEventInvitations(eventId);
      expect(list.invitations).toHaveLength(1);
      expect(JSON.stringify(list.invitations)).not.toContain(
        "token_ciphertext",
      );
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });

  it("rejects invalid input, cross-Owner access, and creation for Ended Events", async () => {
    const owner = await createOrganizer();
    const stranger = await createOrganizer();
    try {
      const eventId = await createDraftEvent(owner);
      const owned = operations(owner);
      const foreign = operations(stranger);
      for (const maximumPartySize of ["0", "21", "1.5", ""]) {
        await expect(
          owned.createInvitation(eventId, {
            inviteeName: "Synthetic",
            maximumPartySize,
          }),
        ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
      }
      await expect(
        foreign.createInvitation(eventId, {
          inviteeName: "Synthetic",
          maximumPartySize: "2",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      const result = await owned.createInvitation(eventId, {
        inviteeName: "Synthetic",
        maximumPartySize: "2",
      });
      await expect(
        foreign.getInvitationAdminDetail(eventId, result.invitationId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      const otherEvent = await createDraftEvent(stranger);
      await expect(
        foreign.getInvitationAdminDetail(otherEvent, result.invitationId),
      ).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });

      const past = await serviceClient()
        .from("events")
        .insert({
          owner_user_id: owner.id,
          publication_status: "published",
          published_at: new Date().toISOString(),
          event_type: "wedding",
          event_title: "Past Synthetic Event",
          host_display_names: ["Test Host"],
          event_date: "2000-01-01",
          start_time: "18:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Past Venue",
          venue_address: "Past Address",
        })
        .select("id")
        .single();
      expect(past.error).toBeNull();
      await expect(
        owned.createInvitation(past.data!.id, {
          inviteeName: "Synthetic",
          maximumPartySize: "2",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });

      const published = await serviceClient()
        .from("events")
        .insert({
          owner_user_id: owner.id,
          publication_status: "published",
          published_at: new Date().toISOString(),
          event_type: "wedding",
          event_title: "Future Synthetic Event",
          host_display_names: ["Test Host"],
          event_date: "2099-01-01",
          start_time: "18:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Future Venue",
          venue_address: "Future Address",
        })
        .select("id")
        .single();
      expect(published.error).toBeNull();
      const liveInvitation = await owned.createInvitation(published.data!.id, {
        inviteeName: "Live Synthetic Household",
        maximumPartySize: "2",
      });
      expect(
        (
          await owned.getInvitationAdminDetail(
            published.data!.id,
            liveInvitation.invitationId,
          )
        ).runtimeState,
      ).toBe("published");
    } finally {
      await cleanupOrganizers([owner, stranger]);
    }
  });

  it("rolls back the full transaction when the credential insert fails", async () => {
    const organizer = await createOrganizer();
    try {
      const eventId = await createDraftEvent(organizer);
      const service = operations(organizer);
      const first = await service.createInvitation(eventId, {
        inviteeName: "First Synthetic Household",
        maximumPartySize: "2",
      });
      const credential = await serviceClient()
        .from("invitation_access_credentials")
        .select("token_lookup_hash")
        .eq("invitation_id", first.invitationId)
        .single();
      expect(credential.error).toBeNull();
      const failed = await serviceClient().rpc("create_invitation_record", {
        p_owner_user_id: organizer.id,
        p_event_id: eventId,
        p_invitee_name: `Rollback ${randomUUID()}`,
        p_maximum_party_size: 2,
        p_token_lookup_hash: credential.data!.token_lookup_hash,
        p_token_ciphertext: "synthetic-envelope",
        p_token_key_version: 1,
      });
      expect(failed.error).not.toBeNull();
      const invitations = await serviceClient()
        .from("invitations")
        .select("id")
        .eq("event_id", eventId);
      expect(invitations.data).toHaveLength(1);
      const rsvps = await serviceClient()
        .from("rsvps")
        .select("invitation_id")
        .eq("invitation_id", first.invitationId);
      expect(rsvps.data).toHaveLength(1);
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });
});
