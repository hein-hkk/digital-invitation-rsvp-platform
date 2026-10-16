import { describe, expect, it } from "vitest";
import {
  createEventOperations,
  EventServiceError,
} from "@/modules/events/service";
import { emptyEventValues } from "@/modules/events/schema";
import { productionClock } from "@/server/time/clock";
import { cleanupOrganizers, createOrganizer } from "../helpers/local-supabase";

const complete = {
  ...emptyEventValues,
  eventType: "wedding",
  eventTitle: "Synthetic Wedding",
  hostDisplayNames: ["Host One", "Host Two"],
  eventDate: "2099-11-20",
  startTime: "18:00",
  endTime: "22:00",
  eventTimezone: "Asia/Bangkok",
  venueName: "Test Venue",
  venueAddress: "Test Address",
  venueMapUrl: "https://example.test/map",
  dressCode: "Test Dress Code",
  invitationMessage: "Synthetic invitation text",
  venueArrivalNotes: "Synthetic arrival note",
  organizerContactInformation: "Synthetic contact",
};

describe("M4 Event service against local Supabase", () => {
  it("creates an incomplete Draft, reports publication errors, and publishes explicitly", async () => {
    const organizer = await createOrganizer();
    const events = createEventOperations({
      client: organizer.client,
      organizerId: organizer.id,
      clock: productionClock,
    });
    try {
      const empty = await events.createEventDraft();
      expect((await events.getEventWorkspace(empty.eventId)).runtimeState).toBe(
        "draft",
      );
      const draft = await events.createEventDraft({
        eventTitle: "Incomplete Draft",
      });
      expect(draft.runtimeState).toBe("draft");
      expect((await events.getEventWorkspace(draft.eventId)).runtimeState).toBe(
        "draft",
      );
      await expect(events.publishEvent(draft.eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_PUBLISHABLE",
        fieldErrors: { venueName: expect.any(String) },
      });
      expect((await events.getEventWorkspace(draft.eventId)).runtimeState).toBe(
        "draft",
      );
      await events.updateEvent(draft.eventId, complete);
      expect((await events.getEventWorkspace(draft.eventId)).runtimeState).toBe(
        "draft",
      );
      const published = await events.publishEvent(draft.eventId);
      expect(published.runtimeState).toBe("published");
      expect(published.publishedAt).toBeTruthy();
      const workspace = await events.getEventWorkspace(draft.eventId);
      expect(workspace.runtimeState).toBe("published");
      expect(workspace.event.venue_map_url).toBe("https://example.test/map");
      expect(
        (await events.listOwnedEvents()).some(
          (item) => item.id === draft.eventId,
        ),
      ).toBe(true);
      await events.updateEvent(draft.eventId, {
        venueName: "Updated Test Venue",
      });
      expect(
        (await events.getEventWorkspace(draft.eventId)).event.event_title,
      ).toBe("Synthetic Wedding");
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });

  it("rejects invalid Draft timing and Published edits without changing committed fields", async () => {
    const organizer = await createOrganizer();
    const events = createEventOperations({
      client: organizer.client,
      organizerId: organizer.id,
      clock: productionClock,
    });
    try {
      await expect(
        events.createEventDraft({
          ...complete,
          endTime: "18:00",
        }),
      ).rejects.toMatchObject({
        code: "EVENT_INVALID",
        fieldErrors: { endTime: expect.any(String) },
      });
      const { eventId } = await events.createEventDraft(complete);
      await events.publishEvent(eventId);
      await expect(
        events.updateEvent(eventId, { ...complete, venueName: null }),
      ).rejects.toMatchObject({
        code: "EVENT_INVALID",
        fieldErrors: { venueName: expect.any(String) },
      });
      await expect(
        events.updateEvent(eventId, {
          ...complete,
          rsvpDeadlineLocal: "2099-11-20T18:00",
        }),
      ).rejects.toMatchObject({
        code: "EVENT_INVALID",
        fieldErrors: { rsvpDeadlineLocal: expect.any(String) },
      });
      expect((await events.getEventWorkspace(eventId)).event.venue_name).toBe(
        "Test Venue",
      );
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });

  it("blocks another Organizer from reading or mutating an Event", async () => {
    const owner = await createOrganizer();
    const stranger = await createOrganizer();
    const owned = createEventOperations({
      client: owner.client,
      organizerId: owner.id,
      clock: productionClock,
    });
    const wrong = createEventOperations({
      client: stranger.client,
      organizerId: stranger.id,
      clock: productionClock,
    });
    try {
      const { eventId } = await owned.createEventDraft(complete);
      await expect(wrong.getEventWorkspace(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
      await expect(wrong.getEventWorkspace("invalid-id")).rejects.toMatchObject(
        {
          code: "EVENT_NOT_FOUND",
        },
      );
      await expect(wrong.updateEvent(eventId, complete)).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
      await expect(wrong.publishEvent(eventId)).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
      });
      expect(
        (await wrong.listOwnedEvents()).some((item) => item.id === eventId),
      ).toBe(false);
    } finally {
      await cleanupOrganizers([owner, stranger]);
    }
  });

  it("derives Ended from expiration and rejects ordinary mutation", async () => {
    const organizer = await createOrganizer();
    const events = createEventOperations({
      client: organizer.client,
      organizerId: organizer.id,
      clock: productionClock,
    });
    try {
      const { eventId } = await events.createEventDraft({
        ...complete,
        eventDate: "2000-01-01",
      });
      await events.publishEvent(eventId);
      const workspace = await events.getEventWorkspace(eventId);
      expect(workspace.runtimeState).toBe("ended");
      expect(workspace.canMutate).toBe(false);
      await expect(
        events.updateEvent(eventId, { ...complete, eventDate: "2000-01-01" }),
      ).rejects.toBeInstanceOf(EventServiceError);
      await expect(
        events.updateEvent(eventId, { ...complete, eventDate: "2000-01-01" }),
      ).rejects.toMatchObject({ code: "EVENT_NOT_MUTABLE" });
    } finally {
      await cleanupOrganizers([organizer]);
    }
  });
});
