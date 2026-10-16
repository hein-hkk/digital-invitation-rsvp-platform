import { describe, expect, it } from "vitest";
import { createEventOperations } from "@/modules/events/service";
import { createInvitationOperations } from "@/modules/invitations/service";
import type { InvitationTokenConfig } from "@/server/security/invitation-credentials";
import { productionClock } from "@/server/time/clock";
import {
  cleanupOrganizers,
  createInvitation,
  createOrganizer,
  serviceClient,
  type OrganizerFixture,
} from "../helpers/local-supabase";
import { randomBytes } from "node:crypto";

const tokenConfig: InvitationTokenConfig = {
  hashKey: randomBytes(32),
  encryptionKey: randomBytes(32),
  keyVersion: 1,
  baseUrl: "https://example.test",
};

function eventOps(owner: OrganizerFixture) {
  return createEventOperations({
    client: owner.client,
    organizerId: owner.id,
    clock: productionClock,
  });
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

describe("M9 dashboard, search, and deadline reopening", () => {
  it("counts current RSVP data, applies name/status AND filters, and enforces Event ownership", async () => {
    const owner = await createOrganizer();
    const stranger = await createOrganizer();
    try {
      const event = await serviceClient()
        .from("events")
        .insert({
          owner_user_id: owner.id,
          publication_status: "published",
          published_at: new Date().toISOString(),
          event_type: "wedding",
          event_title: "Synthetic Overview",
          host_display_names: ["Host"],
          event_date: "2099-11-29",
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Test Venue",
          venue_address: "Test Address",
          rsvp_deadline_local: "2020-01-01T00:00:00",
        })
        .select("id")
        .single();
      if (event.error || !event.data) throw event.error;
      const eventId = event.data.id;
      const labels = [
        "John & Family",
        "Joanna Household",
        "Mary Family",
        "Declined Family",
        "Awaiting Household",
      ];
      const ids = await Promise.all(
        labels.map((label) => createInvitation(owner, eventId, label)),
      );
      for (const [index, count] of [
        [0, 2],
        [1, 3],
      ] as const) {
        const update = await owner.client.rpc("update_organizer_rsvp", {
          p_event_id: eventId,
          p_invitation_id: ids[index],
          p_status: "attending",
          p_attendee_count: count,
          p_attendee_names: [],
          p_dietary_requirements: "",
        });
        expect(update.error).toBeNull();
      }
      const decline = await owner.client.rpc("update_organizer_rsvp", {
        p_event_id: eventId,
        p_invitation_id: ids[3],
        p_status: "declined",
        p_attendee_count: 0,
        p_attendee_names: [],
        p_dietary_requirements: "",
      });
      expect(decline.error).toBeNull();
      const overview = await eventOps(owner).getEventOverview(eventId);
      expect(overview).toMatchObject({
        totalInvitations: 5,
        attendingInvitations: 2,
        declinedInvitations: 1,
        awaitingResponseInvitations: 2,
        totalExpectedAttendees: 5,
        guestRsvpPolicy: { state: "closed" },
      });
      const all = await invitationOps(owner).listEventInvitations(eventId);
      expect(all.invitations).toHaveLength(5);
      const matches = await invitationOps(owner).listEventInvitations(eventId, {
        search: "  FAMILY ",
        rsvpStatus: "attending",
      });
      expect(matches.totalInvitationCount).toBe(5);
      expect(matches.invitations.map((item) => item.invitee_name)).toEqual([
        "John & Family",
      ]);
      const none = await invitationOps(owner).listEventInvitations(eventId, {
        search: "missing",
        rsvpStatus: "declined",
      });
      expect(none.invitations).toHaveLength(0);
      await expect(
        eventOps(stranger).getEventOverview(eventId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
      await expect(
        invitationOps(stranger).listEventInvitations(eventId),
      ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });

      const changed = await owner.client.rpc("update_organizer_rsvp", {
        p_event_id: eventId,
        p_invitation_id: ids[0],
        p_status: "declined",
        p_attendee_count: 0,
        p_attendee_names: [],
        p_dietary_requirements: "",
      });
      expect(changed.error).toBeNull();
      expect(await eventOps(owner).getEventOverview(eventId)).toMatchObject({
        attendingInvitations: 1,
        declinedInvitations: 2,
        totalExpectedAttendees: 3,
      });

      const ended = await serviceClient()
        .from("events")
        .update({ event_date: "2000-01-01", rsvp_deadline_local: null })
        .eq("id", eventId);
      expect(ended.error).toBeNull();
      expect(
        (await eventOps(owner).getEventOverview(eventId)).guestRsvpPolicy.state,
      ).toBe("ended");
      expect(
        (
          await invitationOps(owner).listEventInvitations(eventId, {
            search: "family",
          })
        ).invitations,
      ).toHaveLength(3);
    } finally {
      await cleanupOrganizers([owner, stranger]);
    }
  });

  it("reopens Guest RSVP only by changing or removing the deadline before Event expiration", async () => {
    const owner = await createOrganizer();
    try {
      const event = await serviceClient()
        .from("events")
        .insert({
          owner_user_id: owner.id,
          publication_status: "published",
          published_at: new Date().toISOString(),
          event_type: "wedding",
          event_title: "Synthetic Reopen",
          host_display_names: ["Host"],
          event_date: "2099-11-29",
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Test Venue",
          venue_address: "Test Address",
          rsvp_deadline_local: "2020-01-01T00:00:00",
        })
        .select("id")
        .single();
      if (event.error || !event.data) throw event.error;
      const eventId = event.data.id;
      const operations = eventOps(owner);
      expect(
        (await operations.getEventOverview(eventId)).guestRsvpPolicy.state,
      ).toBe("closed");
      await operations.updateEvent(eventId, {
        rsvpDeadlineLocal: "2099-11-28T18:00:00",
      });
      expect(
        (await operations.getEventOverview(eventId)).guestRsvpPolicy,
      ).toMatchObject({
        state: "open",
        deadlineLocal: "2099-11-28T18:00:00",
      });
      await operations.updateEvent(eventId, { rsvpDeadlineLocal: null });
      expect(
        (await operations.getEventOverview(eventId)).guestRsvpPolicy,
      ).toMatchObject({
        state: "open",
        deadlineLocal: null,
      });
      const ended = await serviceClient()
        .from("events")
        .update({ event_date: "2000-01-01" })
        .eq("id", eventId);
      expect(ended.error).toBeNull();
      await expect(
        operations.updateEvent(eventId, { rsvpDeadlineLocal: null }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
    } finally {
      await cleanupOrganizers([owner]);
    }
  });
});
