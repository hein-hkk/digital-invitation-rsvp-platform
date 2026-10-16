import { describe, expect, it } from "vitest";
import {
  assertEventMutable,
  eventLocalToInstant,
  getEventExpirationAt,
  getGuestRsvpPolicy,
  getEventRuntimeState,
  isEventDeletable,
  isValidEventTimezone,
  validateEventTiming,
  validatePublication,
  type EventForRuntime,
} from "./domain";

const published: EventForRuntime = {
  publicationStatus: "published",
  eventDate: "2026-11-20",
  endTime: "22:00",
  eventTimezone: "Asia/Bangkok",
};

const clockAt = (iso: string) => ({ now: () => new Date(iso) });

describe("Event time and runtime state", () => {
  it("uses Event-local End Time and changes to Ended at expiration", () => {
    expect(getEventExpirationAt(published).toISOString()).toBe(
      "2026-11-20T15:00:00.000Z",
    );
    expect(
      getEventRuntimeState(published, clockAt("2026-11-20T14:59:59.999Z")),
    ).toBe("published");
    expect(
      getEventRuntimeState(published, clockAt("2026-11-20T15:00:00.000Z")),
    ).toBe("ended");
    expect(() =>
      assertEventMutable(published, clockAt("2026-11-20T15:00:00.000Z")),
    ).toThrow("EVENT_NOT_MUTABLE");
    expect(isEventDeletable(published, clockAt("2026-11-20T15:00:00Z"))).toBe(
      true,
    );
  });

  it("expires without End Time at the start of the next Event-local day", () => {
    expect(
      getEventExpirationAt({ ...published, endTime: null }).toISOString(),
    ).toBe("2026-11-20T17:00:00.000Z");
  });

  it("keeps incomplete Drafts as Draft and permits their deletion", () => {
    const draft: EventForRuntime = {
      publicationStatus: "draft",
      eventDate: null,
      endTime: null,
      eventTimezone: null,
    };
    expect(getEventRuntimeState(draft, clockAt("2026-01-01T00:00:00Z"))).toBe(
      "draft",
    );
    expect(isEventDeletable(draft, clockAt("2026-01-01T00:00:00Z"))).toBe(true);
  });

  it("uses IANA timezone transitions for Event-local times", () => {
    expect(
      eventLocalToInstant("2026-11-01T01:30", "America/New_York").toISOString(),
    ).toBe("2026-11-01T06:30:00.000Z");
    expect(
      eventLocalToInstant("2026-03-08T02:30", "America/New_York").toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
  });

  it("derives Guest RSVP availability from publication, deadline, and expiration", () => {
    const event = { ...published, rsvpDeadlineLocal: "2026-11-19T18:00" };
    expect(
      getGuestRsvpPolicy(event, clockAt("2026-11-19T10:59:59Z")).state,
    ).toBe("open");
    expect(
      getGuestRsvpPolicy(event, clockAt("2026-11-19T11:00:00Z")).state,
    ).toBe("closed");
    expect(
      getGuestRsvpPolicy(
        { ...event, rsvpDeadlineLocal: null },
        clockAt("2026-11-19T11:00:00Z"),
      ).state,
    ).toBe("open");
    expect(
      getGuestRsvpPolicy(
        { ...event, publicationStatus: "draft" },
        clockAt("2026-11-19T10:00:00Z"),
      ).state,
    ).toBe("closed");
    expect(
      getGuestRsvpPolicy(
        { ...event, rsvpDeadlineLocal: null },
        clockAt("2026-11-20T15:00:00Z"),
      ).state,
    ).toBe("ended");
  });
});

describe("Event validation", () => {
  it("accepts a deadline before Start and rejects equal, later, or cross-midnight timing", () => {
    const timing = {
      eventDate: "2099-11-20",
      startTime: "18:00",
      endTime: "22:00",
      eventTimezone: "Asia/Bangkok",
      rsvpDeadlineLocal: "2099-11-20T17:59",
    };
    expect(validateEventTiming(timing)).toEqual({});
    expect(
      validateEventTiming({ ...timing, rsvpDeadlineLocal: "2099-11-20T18:00" }),
    ).toHaveProperty("rsvpDeadlineLocal");
    expect(
      validateEventTiming({ ...timing, rsvpDeadlineLocal: "2099-11-20T18:01" }),
    ).toHaveProperty("rsvpDeadlineLocal");
    expect(validateEventTiming({ ...timing, endTime: "17:00" })).toHaveProperty(
      "endTime",
    );
  });
  it("validates IANA timezone, same-day End Time, and deadline ordering", () => {
    expect(isValidEventTimezone("Asia/Bangkok")).toBe(true);
    expect(isValidEventTimezone("Not/A_Timezone")).toBe(false);
    expect(
      validateEventTiming({
        eventDate: "2026-11-20",
        startTime: "18:00",
        endTime: "18:00",
        eventTimezone: "Not/A_Timezone",
        rsvpDeadlineLocal: "2026-11-20T18:00",
      }),
    ).toMatchObject({
      endTime: expect.any(String),
      eventTimezone: expect.any(String),
      rsvpDeadlineLocal: expect.any(String),
    });
  });

  it("allows incomplete Drafts but reports every required publication field", () => {
    const incomplete = {
      eventType: null,
      eventTitle: null,
      hostDisplayNames: [],
      eventDate: null,
      startTime: null,
      endTime: null,
      eventTimezone: null,
      rsvpDeadlineLocal: null,
      venueName: null,
      venueAddress: null,
    };
    expect(validateEventTiming(incomplete)).toEqual({});
    expect(Object.keys(validatePublication(incomplete))).toHaveLength(8);
  });
});
