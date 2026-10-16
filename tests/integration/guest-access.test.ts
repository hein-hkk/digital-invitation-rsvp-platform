import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGuestAccessService } from "@/modules/guest-access/service";
import {
  createInvitationCredential,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import {
  cleanupOrganizers,
  createOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

const tokenConfig: InvitationTokenConfig = {
  hashKey: randomBytes(32),
  encryptionKey: randomBytes(32),
  keyVersion: 1,
  baseUrl: "https://example.test",
};

const at = (value: string) => ({ now: () => new Date(value) });

async function createEvent(ownerId: string, status: "draft" | "published") {
  const result = await serviceClient()
    .from("events")
    .insert({
      owner_user_id: ownerId,
      publication_status: status,
      published_at: status === "published" ? "2099-11-20T00:00:00Z" : null,
      event_type: "wedding",
      event_title: "Private Event Title",
      host_display_names: ["Synthetic Host"],
      event_date: "2099-11-29",
      start_time: "18:00",
      end_time: "21:00",
      event_timezone: "Asia/Bangkok",
      rsvp_deadline_local: "2099-11-28T18:00:00",
      venue_name: "Private Venue",
      venue_address: "Private Address",
      invitation_message: "Private invitation message",
    })
    .select("id")
    .single();
  if (result.error || !result.data) throw result.error;
  return result.data.id;
}

async function addInvitation(ownerId: string, eventId: string, name: string) {
  const credential = createInvitationCredential(tokenConfig);
  const result = await serviceClient().rpc("create_invitation_record", {
    p_owner_user_id: ownerId,
    p_event_id: eventId,
    p_invitee_name: name,
    p_maximum_party_size: 3,
    p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
    p_token_ciphertext: credential.ciphertext,
    p_token_key_version: credential.keyVersion,
  });
  if (result.error || !result.data) throw result.error;
  return { token: credential.rawToken, id: result.data };
}

describe("M6 Guest access against local Supabase", () => {
  it("resolves only the current Invitation and returns a Guest-safe projection", async () => {
    const organizer = await createOrganizer();
    try {
      const eventId = await createEvent(organizer.id, "published");
      const first = await addInvitation(
        organizer.id,
        eventId,
        "First Household",
      );
      const second = await addInvitation(
        organizer.id,
        eventId,
        "Second Household",
      );
      const guest = createGuestAccessService({
        client: serviceClient(),
        tokenConfig,
        clock: at("2099-11-20T00:00:00Z"),
      });
      const result = await guest.resolveGuestInvitation(first.token);
      expect(result).toMatchObject({
        ok: true,
        value: {
          inviteeName: "First Household",
          maximumPartySize: 3,
          event: { venueName: "Private Venue", heroImageSignedUrl: null },
          rsvp: { status: "awaiting_response" },
          permission: { canEditRsvp: true },
        },
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(second.token);
      expect(serialized).not.toContain("Second Household");
      expect(serialized).not.toContain(first.id);
      expect(serialized).not.toContain(first.token);
      expect(serialized).not.toContain("token_lookup_hash");
      expect(await guest.resolveGuestInvitation(second.token)).toMatchObject({
        ok: true,
        value: { inviteeName: "Second Household" },
      });
      expect(
        await guest.resolveGuestInvitation(first.token.slice(0, 42)),
      ).toMatchObject({ ok: false });
      expect(
        await guest.resolveGuestInvitation(
          randomBytes(32).toString("base64url"),
        ),
      ).toMatchObject({ ok: false });
      const afterDeadline = createGuestAccessService({
        client: serviceClient(),
        tokenConfig,
        clock: at("2099-11-28T11:00:00Z"),
      });
      expect(
        await afterDeadline.resolveGuestInvitation(first.token),
      ).toMatchObject({
        ok: true,
        value: { permission: { canEditRsvp: false } },
      });
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });

  it("hides Draft, revoked, Ended, and obsolete Invitations behind one unavailable result", async () => {
    const organizer = await createOrganizer();
    try {
      const eventId = await createEvent(organizer.id, "draft");
      const invitation = await addInvitation(
        organizer.id,
        eventId,
        "Hidden Household",
      );
      const guest = createGuestAccessService({
        client: serviceClient(),
        tokenConfig,
        clock: at("2099-11-20T00:00:00Z"),
      });
      const draft = await guest.resolveGuestInvitation(invitation.token);
      expect(draft).toMatchObject({ ok: false });
      const publish = await serviceClient()
        .from("events")
        .update({
          publication_status: "published",
          published_at: "2099-11-20T00:00:00Z",
        })
        .eq("id", eventId);
      if (publish.error) throw publish.error;
      const revoke = await serviceClient()
        .from("invitations")
        .update({ revoked_at: "2099-11-20T00:00:00Z" })
        .eq("id", invitation.id);
      if (revoke.error) throw revoke.error;
      const revoked = await guest.resolveGuestInvitation(invitation.token);
      expect(revoked).toEqual(draft);
      const unrevoke = await serviceClient()
        .from("invitations")
        .update({ revoked_at: null })
        .eq("id", invitation.id);
      if (unrevoke.error) throw unrevoke.error;
      const ended = await createGuestAccessService({
        client: serviceClient(),
        tokenConfig,
        clock: at("2099-11-29T14:00:00Z"),
      }).resolveGuestInvitation(invitation.token);
      expect(ended).toEqual(draft);
      const replacement = createInvitationCredential(tokenConfig);
      const rotate = await serviceClient()
        .from("invitation_access_credentials")
        .update({
          token_lookup_hash: `\\x${replacement.lookupHash.toString("hex")}`,
          token_ciphertext: replacement.ciphertext,
        })
        .eq("invitation_id", invitation.id);
      if (rotate.error) throw rotate.error;
      expect(await guest.resolveGuestInvitation(invitation.token)).toEqual(
        draft,
      );
      expect(
        await guest.resolveGuestInvitation(replacement.rawToken),
      ).toMatchObject({ ok: true });
      expect(JSON.stringify(draft)).not.toContain("Hidden Household");
      expect(JSON.stringify(draft)).not.toContain("Private Venue");
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });
});
