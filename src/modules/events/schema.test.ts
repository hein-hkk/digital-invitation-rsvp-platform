import { describe, expect, it } from "vitest";
import { emptyEventValues, validateEventValues } from "./schema";

describe("M4 Event input validation", () => {
  it("allows an incomplete Draft but rejects invalid supplied timing and URLs", () => {
    expect(validateEventValues(emptyEventValues, false)).toEqual({});
    expect(
      validateEventValues(
        {
          ...emptyEventValues,
          eventDate: "2099-11-20",
          startTime: "18:00",
          endTime: "17:00",
          rsvpDeadlineLocal: "2099-11-20T18:00",
          venueMapUrl: "javascript:alert(1)",
        },
        false,
      ),
    ).toMatchObject({
      endTime: expect.any(String),
      rsvpDeadlineLocal: expect.any(String),
      venueMapUrl: expect.any(String),
    });
  });

  it("allows a valid HTTPS venue link and requires all publication fields", () => {
    expect(
      validateEventValues(
        { ...emptyEventValues, venueMapUrl: "https://example.test/map" },
        false,
      ),
    ).toEqual({});
    expect(Object.keys(validateEventValues(emptyEventValues, true))).toContain(
      "venueName",
    );
    expect(
      validateEventValues(
        { ...emptyEventValues, eventTitle: "   ", hostDisplayNames: [" "] },
        false,
      ),
    ).toMatchObject({
      eventTitle: expect.any(String),
      hostDisplayNames: expect.any(String),
    });
  });
});
