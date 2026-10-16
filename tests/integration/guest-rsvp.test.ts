import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGuestAccessService } from "@/modules/guest-access/service";
import {
  createGuestRsvpOperations,
  GuestRsvpServiceError,
} from "@/modules/rsvp/guest-service";
import {
  createInvitationCredential,
  type InvitationTokenConfig,
} from "@/server/security/invitation-credentials";
import {
  anonymousClient,
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

async function setup(ownerId: string, deadline: string | null = null) {
  const event = await serviceClient()
    .from("events")
    .insert({
      owner_user_id: ownerId,
      publication_status: "published",
      published_at: "2099-11-20T00:00:00Z",
      event_type: "wedding",
      event_title: "Synthetic RSVP Event",
      host_display_names: ["Host"],
      event_date: "2099-11-29",
      start_time: "18:00",
      end_time: "21:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Test Venue",
      venue_address: "Test Address",
      rsvp_deadline_local: deadline,
    })
    .select("id")
    .single();
  if (event.error || !event.data) throw event.error;
  const credential = createInvitationCredential(tokenConfig);
  const invitation = await serviceClient().rpc("create_invitation_record", {
    p_owner_user_id: ownerId,
    p_event_id: event.data.id,
    p_invitee_name: "Test Household",
    p_maximum_party_size: 3,
    p_token_lookup_hash: `\\x${credential.lookupHash.toString("hex")}`,
    p_token_ciphertext: credential.ciphertext,
    p_token_key_version: 1,
  });
  if (invitation.error || !invitation.data) throw invitation.error;
  return {
    eventId: event.data.id,
    invitationId: invitation.data,
    token: credential.rawToken,
  };
}

function operations(observedAt?: string) {
  return createGuestRsvpOperations({
    client: serviceClient(),
    tokenConfig,
    observedAt: observedAt ? () => new Date(observedAt) : undefined,
  });
}

describe("M7 Guest RSVP transaction against local Supabase", () => {
  it("saves Attending, partial/duplicate names, updates, Declined cleanup, and Declined to Attending", async () => {
    const owner = await createOrganizer();
    try {
      const fixture = await setup(owner.id);
      const guest = operations("2099-11-20T00:00:00Z");
      const first = await guest.submitGuestRsvp(fixture.token, {
        status: "attending",
        attendeeCount: 3,
        attendeeNames: ["Alex"],
        dietaryRequirements: "Vegetarian",
        guestMessage: "Thank you!",
      });
      expect(first.rsvp).toMatchObject({
        status: "attending",
        attendeeCount: 3,
        attendeeNames: ["Alex"],
        dietaryRequirements: "Vegetarian",
        guestMessage: "Thank you!",
      });
      expect(first.rsvp.respondedAt).toBeTruthy();
      expect(first.rsvp.updatedAt).toBeTruthy();
      expect(JSON.stringify(first)).not.toContain(fixture.invitationId);
      expect(JSON.stringify(first)).not.toContain(fixture.token);
      const allNamed = await guest.submitGuestRsvp(fixture.token, {
        status: "attending",
        attendeeCount: 3,
        attendeeNames: ["Alex", "Sam", "Taylor"],
      });
      expect(allNamed.rsvp.attendeeNames).toHaveLength(3);
      const updated = await guest.submitGuestRsvp(fixture.token, {
        status: "attending",
        attendeeCount: 2,
        attendeeNames: ["Alex", "Alex"],
      });
      expect(updated.rsvp.attendeeNames).toEqual(["Alex", "Alex"]);
      expect(updated.rsvp.guestMessage).toBe("Thank you!");
      const declined = await guest.submitGuestRsvp(fixture.token, {
        status: "declined",
        attendeeCount: 18,
        attendeeNames: ["stale"],
        dietaryRequirements: "stale",
      });
      expect(declined.rsvp).toMatchObject({
        status: "declined",
        attendeeCount: 0,
        attendeeNames: [],
        dietaryRequirements: null,
        guestMessage: "Thank you!",
      });
      const attendingAgain = await guest.submitGuestRsvp(fixture.token, {
        status: "attending",
        attendeeCount: 1,
        attendeeNames: [],
      });
      expect(attendingAgain.rsvp).toMatchObject({
        status: "attending",
        attendeeCount: 1,
        attendeeNames: [],
        guestMessage: "Thank you!",
      });
      const read = await createGuestAccessService({
        client: serviceClient(),
        tokenConfig,
        clock: { now: () => new Date("2099-11-20T00:00:00Z") },
      }).resolveGuestInvitation(fixture.token);
      expect(read).toMatchObject({
        ok: true,
        value: { rsvp: attendingAgain.rsvp },
      });
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("rejects crafted counts and names, then rechecks a reduced party limit", async () => {
    const owner = await createOrganizer();
    try {
      const fixture = await setup(owner.id);
      const guest = operations("2099-11-20T00:00:00Z");
      for (const attendeeCount of [undefined, 0, 1.5, Number.NaN, 4]) {
        await expect(
          guest.submitGuestRsvp(fixture.token, {
            status: "attending",
            attendeeCount,
          }),
        ).rejects.toBeInstanceOf(GuestRsvpServiceError);
      }
      await expect(
        guest.submitGuestRsvp(fixture.token, {
          status: "attending",
          attendeeCount: 1,
          attendeeNames: ["A", "B"],
        }),
      ).rejects.toMatchObject({ code: "RSVP_TOO_MANY_NAMES" });
      await guest.submitGuestRsvp(fixture.token, {
        status: "attending",
        attendeeCount: 1,
      });
      const reduce = await serviceClient()
        .from("invitations")
        .update({ maximum_party_size: 2 })
        .eq("id", fixture.invitationId);
      if (reduce.error) throw reduce.error;
      await expect(
        guest.submitGuestRsvp(fixture.token, {
          status: "attending",
          attendeeCount: 3,
        }),
      ).rejects.toMatchObject({ code: "RSVP_PARTY_LIMIT" });
      const saved = await serviceClient()
        .from("rsvps")
        .select("attendee_count")
        .eq("invitation_id", fixture.invitationId)
        .single();
      expect(saved.data?.attendee_count).toBe(1);
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("denies the deadline boundary after a form was read and keeps the RSVP unchanged", async () => {
    const owner = await createOrganizer();
    try {
      const fixture = await setup(owner.id, "2099-11-28T18:00:00");
      const before = await createGuestAccessService({
        client: serviceClient(),
        tokenConfig,
        clock: { now: () => new Date("2099-11-28T10:59:59Z") },
      }).resolveGuestInvitation(fixture.token);
      expect(before).toMatchObject({
        ok: true,
        value: { permission: { canEditRsvp: true } },
      });
      await expect(
        operations("2099-11-28T11:00:00Z").submitGuestRsvp(fixture.token, {
          status: "attending",
          attendeeCount: 1,
        }),
      ).rejects.toMatchObject({ code: "RSVP_READ_ONLY" });
      const saved = await serviceClient()
        .from("rsvps")
        .select("status,attendee_count")
        .eq("invitation_id", fixture.invitationId)
        .single();
      expect(saved.data).toMatchObject({
        status: "awaiting_response",
        attendee_count: 0,
      });
      const reopen = await serviceClient()
        .from("events")
        .update({ rsvp_deadline_local: null })
        .eq("id", fixture.eventId);
      if (reopen.error) throw reopen.error;
      expect(
        (
          await operations("2099-11-28T11:00:00Z").submitGuestRsvp(
            fixture.token,
            { status: "attending", attendeeCount: 1 },
          )
        ).rsvp.status,
      ).toBe("attending");
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("denies malformed, obsolete, revoked, Draft, and Ended access without changing another Invitation", async () => {
    const owner = await createOrganizer();
    try {
      const fixture = await setup(owner.id);
      const guest = operations("2099-11-20T00:00:00Z");
      await expect(
        guest.submitGuestRsvp("malformed", {
          status: "declined",
        }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      const unknown = randomBytes(32).toString("base64url");
      await expect(
        guest.submitGuestRsvp(unknown, { status: "declined" }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      const draftEvent = await serviceClient()
        .from("events")
        .insert({ owner_user_id: owner.id, event_title: "Draft RSVP Event" })
        .select("id")
        .single();
      if (draftEvent.error || !draftEvent.data) throw draftEvent.error;
      const draftCredential = createInvitationCredential(tokenConfig);
      const draftInvitation = await serviceClient().rpc(
        "create_invitation_record",
        {
          p_owner_user_id: owner.id,
          p_event_id: draftEvent.data.id,
          p_invitee_name: "Draft Household",
          p_maximum_party_size: 2,
          p_token_lookup_hash: `\\x${draftCredential.lookupHash.toString("hex")}`,
          p_token_ciphertext: draftCredential.ciphertext,
          p_token_key_version: 1,
        },
      );
      if (draftInvitation.error) throw draftInvitation.error;
      await expect(
        guest.submitGuestRsvp(draftCredential.rawToken, { status: "declined" }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      const revoke = await serviceClient()
        .from("invitations")
        .update({ revoked_at: "2099-11-20T00:00:00Z" })
        .eq("id", fixture.invitationId);
      if (revoke.error) throw revoke.error;
      await expect(
        guest.submitGuestRsvp(fixture.token, { status: "declined" }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      const unrevoke = await serviceClient()
        .from("invitations")
        .update({ revoked_at: null })
        .eq("id", fixture.invitationId);
      if (unrevoke.error) throw unrevoke.error;
      const replacement = createInvitationCredential(tokenConfig);
      const rotate = await serviceClient()
        .from("invitation_access_credentials")
        .update({
          token_lookup_hash: `\\x${replacement.lookupHash.toString("hex")}`,
          token_ciphertext: replacement.ciphertext,
        })
        .eq("invitation_id", fixture.invitationId);
      if (rotate.error) throw rotate.error;
      await expect(
        guest.submitGuestRsvp(fixture.token, { status: "declined" }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      const ended = operations("2099-11-29T14:00:00Z");
      await expect(
        ended.submitGuestRsvp(replacement.rawToken, { status: "declined" }),
      ).rejects.toMatchObject({ code: "INVITATION_UNAVAILABLE" });
      const saved = await serviceClient()
        .from("rsvps")
        .select("status")
        .eq("invitation_id", fixture.invitationId)
        .single();
      expect(saved.data?.status).toBe("awaiting_response");
      const anon = await anonymousClient().rpc("submit_guest_rsvp", {
        p_token_lookup_hash: `\\x${replacement.lookupHash.toString("hex")}`,
        p_status: "declined",
        p_attendee_count: 0,
        p_attendee_names: [],
        p_dietary_requirements: "",
        p_guest_message: "",
        p_guest_message_present: false,
      });
      expect(anon.error).not.toBeNull();
    } finally {
      await cleanupOrganizers([owner]);
    }
  });
});
