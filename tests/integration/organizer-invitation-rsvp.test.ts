import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createInvitationOperations } from "@/modules/invitations/service";
import { createOrganizerRsvpOperations } from "@/modules/rsvp/organizer-service";
import type { InvitationTokenConfig } from "@/server/security/invitation-credentials";
import { productionClock } from "@/server/time/clock";
import {
  cleanupOrganizers,
  createInvitation,
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

async function setup(owner: OrganizerFixture, date = "2099-11-29") {
  const event = await serviceClient()
    .from("events")
    .insert({
      owner_user_id: owner.id,
      publication_status: "published",
      published_at: new Date().toISOString(),
      event_type: "wedding",
      event_title: "Synthetic M8 Event",
      host_display_names: ["Test Host"],
      event_date: date,
      start_time: "18:00",
      end_time: "21:00",
      event_timezone: "Asia/Bangkok",
      venue_name: "Test Venue",
      venue_address: "Test Address",
      rsvp_deadline_local: date === "2099-11-29" ? "2020-01-01T00:00:00" : null,
    })
    .select("id")
    .single();
  if (event.error || !event.data) throw event.error;
  const invitationId = await createInvitation(
    owner,
    event.data.id,
    "Synthetic Household",
    3,
  );
  return { eventId: event.data.id, invitationId };
}

function invitationOps(owner: OrganizerFixture) {
  return createInvitationOperations({
    client: owner.client,
    credentialClient: serviceClient(),
    organizerId: owner.id,
    clock: productionClock,
    tokenConfig,
  });
}

function rsvpOps(owner: OrganizerFixture) {
  return createOrganizerRsvpOperations({
    client: owner.client,
    organizerId: owner.id,
    clock: productionClock,
  });
}

describe("M8 Organizer Invitation and RSVP management", () => {
  it("edits permitted fields after Guest deadline, preserves Guest Message, and rejects a conflicting size reduction", async () => {
    const owner = await createOrganizer();
    try {
      const { eventId, invitationId } = await setup(owner);
      const adminRsvp = rsvpOps(owner);
      const adminInvitation = invitationOps(owner);
      await adminRsvp.updateOrganizerRsvp(eventId, invitationId, {
        status: "attending",
        attendeeCount: 3,
        attendeeNames: ["Alex", "Alex"],
        dietaryRequirements: "Vegetarian",
      });
      const seed = await serviceClient()
        .from("rsvps")
        .update({ guest_message: "Guest-authored note" })
        .eq("invitation_id", invitationId);
      expect(seed.error).toBeNull();
      const attending = await adminRsvp.updateOrganizerRsvp(
        eventId,
        invitationId,
        {
          status: "attending",
          attendeeCount: 3,
          attendeeNames: ["Alex", "Alex"],
          dietaryRequirements: "Vegetarian",
        },
      );
      expect(attending.rsvp).toMatchObject({
        status: "attending",
        attendee_count: 3,
        attendee_names: ["Alex", "Alex"],
        dietary_requirements: "Vegetarian",
        guest_message: "Guest-authored note",
      });
      await expect(
        adminInvitation.updateInvitation(eventId, invitationId, {
          inviteeName: "Changed Household",
          maximumPartySize: "2",
        }),
      ).rejects.toMatchObject({
        code: "MAX_PARTY_SIZE_CONFLICT",
        fieldErrors: {
          maximumPartySize: expect.stringContaining(
            "current Attendee Count of 3",
          ),
        },
      });
      const currentAfterConflict = await owner.client
        .from("rsvps")
        .select("attendee_count")
        .eq("invitation_id", invitationId)
        .single();
      expect(currentAfterConflict.data?.attendee_count).toBe(3);

      const declined = await adminRsvp.updateOrganizerRsvp(
        eventId,
        invitationId,
        {
          status: "declined",
          attendeeCount: 20,
          attendeeNames: ["ignored"],
          dietaryRequirements: "ignored",
        },
      );
      expect(declined.rsvp).toMatchObject({
        status: "declined",
        attendee_count: 0,
        attendee_names: [],
        dietary_requirements: null,
        guest_message: "Guest-authored note",
      });
      const changed = await adminInvitation.updateInvitation(
        eventId,
        invitationId,
        {
          inviteeName: " Changed Household ",
          maximumPartySize: "2",
        },
      );
      expect(changed.invitation).toMatchObject({
        invitee_name: "Changed Household",
        maximum_party_size: 2,
      });
      const attendingAgain = await adminRsvp.updateOrganizerRsvp(
        eventId,
        invitationId,
        {
          status: "attending",
          attendeeCount: 2,
          attendeeNames: [],
        },
      );
      expect(attendingAgain.rsvp.guest_message).toBe("Guest-authored note");
    } finally {
      await cleanupOrganizers([owner]);
    }
  });

  it("rejects injected Guest Message, invalid values, cross-Owner mutation, and Ended writes", async () => {
    const owner = await createOrganizer();
    const stranger = await createOrganizer();
    try {
      const { eventId, invitationId } = await setup(owner);
      await expect(
        rsvpOps(owner).updateOrganizerRsvp(eventId, invitationId, {
          status: "attending",
          attendeeCount: 1,
          guestMessage: "injected",
        }),
      ).rejects.toMatchObject({ code: "RSVP_INVALID" });
      await expect(
        rsvpOps(owner).updateOrganizerRsvp(eventId, invitationId, {
          status: "attending",
          attendeeCount: 4,
        }),
      ).rejects.toMatchObject({ code: "RSVP_PARTY_LIMIT", detail: 3 });
      await expect(
        rsvpOps(owner).updateOrganizerRsvp(eventId, invitationId, {
          status: "attending",
          attendeeCount: 1,
          attendeeNames: ["A", "B"],
        }),
      ).rejects.toMatchObject({ code: "RSVP_TOO_MANY_NAMES" });
      await expect(
        rsvpOps(stranger).updateOrganizerRsvp(eventId, invitationId, {
          status: "declined",
        }),
      ).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
      await expect(
        invitationOps(stranger).updateInvitation(eventId, invitationId, {
          inviteeName: "Attack",
          maximumPartySize: "1",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      const ended = await setup(owner);
      const expire = await serviceClient()
        .from("events")
        .update({ event_date: "2000-01-01", rsvp_deadline_local: null })
        .eq("id", ended.eventId);
      expect(expire.error).toBeNull();
      await expect(
        rsvpOps(owner).updateOrganizerRsvp(ended.eventId, ended.invitationId, {
          status: "declined",
        }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
      await expect(
        invitationOps(owner).updateInvitation(
          ended.eventId,
          ended.invitationId,
          {
            inviteeName: "Changed",
            maximumPartySize: "2",
          },
        ),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
      const direct = await owner.client.rpc("update_organizer_rsvp", {
        p_event_id: ended.eventId,
        p_invitation_id: ended.invitationId,
        p_status: "declined",
        p_attendee_count: 0,
        p_attendee_names: [],
        p_dietary_requirements: "",
      });
      expect(direct.error?.message).toBe("EVENT_NOT_MUTABLE");
    } finally {
      await cleanupOrganizers([owner, stranger]);
    }
  });

  it("CONC-01 serializes a conflicting RSVP increase and party-size reduction", async () => {
    const owner = await createOrganizer();
    try {
      const { eventId, invitationId } = await setup(owner);
      const [rsvp, invitation] = await Promise.all([
        owner.client.rpc("update_organizer_rsvp", {
          p_event_id: eventId,
          p_invitation_id: invitationId,
          p_status: "attending",
          p_attendee_count: 3,
          p_attendee_names: [],
          p_dietary_requirements: "",
        }),
        owner.client.rpc("update_invitation_record", {
          p_event_id: eventId,
          p_invitation_id: invitationId,
          p_invitee_name: "Synthetic Household",
          p_maximum_party_size: 2,
        }),
      ]);
      expect([rsvp.error, invitation.error].filter(Boolean)).toHaveLength(1);
      const currentRsvp = await owner.client
        .from("rsvps")
        .select("attendee_count")
        .eq("invitation_id", invitationId)
        .single();
      const currentInvitation = await owner.client
        .from("invitations")
        .select("maximum_party_size")
        .eq("id", invitationId)
        .single();
      expect(currentRsvp.error).toBeNull();
      expect(currentInvitation.error).toBeNull();
      expect(currentRsvp.data!.attendee_count).toBeLessThanOrEqual(
        currentInvitation.data!.maximum_party_size,
      );
    } finally {
      await cleanupOrganizers([owner]);
    }
  });
});
