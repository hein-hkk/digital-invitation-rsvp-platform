import { describe, expect, it } from "vitest";
import {
  canReduceMaximumPartySize,
  getGuestRsvpPermission,
  isValidMaximumPartySize,
  normalizeRsvp,
} from "./domain";

const event = {
  publicationStatus: "published" as const,
  eventDate: "2026-11-20",
  endTime: "22:00",
  eventTimezone: "Asia/Bangkok",
  rsvpDeadlineLocal: "2026-11-19T18:00",
};
const access = { isCurrentToken: true, revokedAt: null };
const clockAt = (iso: string) => ({ now: () => new Date(iso) });

describe("Maximum Party Size", () => {
  it("accepts only integer 1 through 20 and rejects size reductions below attendance", () => {
    expect(isValidMaximumPartySize(1)).toBe(true);
    expect(isValidMaximumPartySize(20)).toBe(true);
    for (const value of [0, 21, 1.5, "3", null]) {
      expect(isValidMaximumPartySize(value)).toBe(false);
    }
    expect(canReduceMaximumPartySize(2, 3)).toBe(false);
    expect(canReduceMaximumPartySize(3, 3)).toBe(true);
  });
});

describe("RSVP normalization", () => {
  it("allows partially provided or duplicate names when Attending", () => {
    expect(
      normalizeRsvp(
        { status: "attending", attendeeCount: 3, attendeeNames: ["A", "A"] },
        3,
      ),
    ).toMatchObject({ attendeeCount: 3, attendeeNames: ["A", "A"] });
    expect(() =>
      normalizeRsvp(
        {
          status: "attending",
          attendeeCount: 2,
          attendeeNames: ["A", "B", "C"],
        },
        3,
      ),
    ).toThrow();
    expect(() =>
      normalizeRsvp({ status: "attending", attendeeCount: 4 }, 3),
    ).toThrow();
  });

  it("clears attendance-only data on Declined while preserving Guest Message", () => {
    expect(
      normalizeRsvp(
        {
          status: "declined",
          attendeeCount: 3,
          attendeeNames: ["A"],
          dietaryRequirements: "Vegetarian",
        },
        3,
        "Thank you",
      ),
    ).toEqual({
      status: "declined",
      attendeeCount: 0,
      attendeeNames: [],
      dietaryRequirements: null,
      guestMessage: "Thank you",
    });
  });
});

describe("Guest RSVP permission", () => {
  it("keeps a valid invitation readable at the deadline while disabling edits", () => {
    expect(
      getGuestRsvpPermission(event, access, clockAt("2026-11-19T10:59:59Z")),
    ).toEqual({ canReadInvitation: true, canEditRsvp: true });
    expect(
      getGuestRsvpPermission(event, access, clockAt("2026-11-19T11:00:00Z")),
    ).toEqual({ canReadInvitation: true, canEditRsvp: false });
  });

  it("denies revoked, obsolete, Draft, and Ended access", () => {
    for (const denied of [
      { event, access: { ...access, isCurrentToken: false } },
      { event, access: { ...access, revokedAt: "2026-11-01T00:00:00Z" } },
      { event: { ...event, publicationStatus: "draft" as const }, access },
      { event, access, at: "2026-11-20T15:00:00Z" },
    ]) {
      expect(
        getGuestRsvpPermission(
          denied.event,
          denied.access,
          clockAt(denied.at ?? "2026-11-19T10:00:00Z"),
        ),
      ).toEqual({ canReadInvitation: false, canEditRsvp: false });
    }
  });
});
