import { describe, expect, it } from "vitest";
import {
  csvFilename,
  csvHeaders,
  neutralizeCsvFormula,
  serializeEventCsv,
  type CsvInvitation,
} from "./csv";

function invitation(overrides: Partial<CsvInvitation> = {}): CsvInvitation {
  return {
    invitee_name: "Sample Household",
    maximum_party_size: 3,
    rsvps: {
      status: "attending",
      attendee_count: 2,
      attendee_names: ["Alex", "Sam"],
      dietary_requirements: "Vegetarian",
      guest_message: "See you there",
      responded_at: "2026-10-17T10:00:00+00:00",
      response_updated_at: "2026-10-18T10:00:00+00:00",
    },
    ...overrides,
  };
}

describe("M11 CSV formatting", () => {
  it("uses exact approved header order and serializes attendee names in one cell", () => {
    const csv = serializeEventCsv([invitation()]);
    expect(csv.split("\r\n")[0]).toBe(csvHeaders.join(","));
    expect(csv).toContain(
      "Sample Household,Attending,3,2,Alex; Sam,Vegetarian,See you there",
    );
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(serializeEventCsv([])).toBe(`${csvHeaders.join(",")}\r\n`);
  });

  it("exports zero and no attendance details for Declined and Awaiting Response", () => {
    const stale = invitation({
      rsvps: {
        ...invitation().rsvps!,
        status: "declined",
        attendee_count: 2,
      },
    });
    const csv = serializeEventCsv([
      stale,
      invitation({ invitee_name: "Awaiting", rsvps: null }),
    ]);
    expect(csv).toContain("Sample Household,Declined,3,0,,,See you there");
    expect(csv).toContain("Awaiting,Awaiting Response,3,0,,,,,");
    expect(csv).not.toContain("Alex; Sam");
    expect(csv).not.toContain("Vegetarian");
  });

  it("escapes commas, quotes, CR/LF, and preserves Unicode as UTF-8 text", () => {
    const csv = serializeEventCsv([
      invitation({
        invitee_name: 'Chloé, "Family"',
        rsvps: {
          ...invitation().rsvps!,
          guest_message: "สวัสดี\r\nSecond line",
        },
      }),
    ]);
    expect(csv).toContain('"Chloé, ""Family"""');
    expect(csv).toContain('"สวัสดี\r\nSecond line"');
    expect(Buffer.from(csv, "utf8").toString("utf8")).toBe(csv);
  });

  it.each([
    "=SUM(A1:A2)",
    "+1+1",
    "-1+1",
    "@SUM(A1:A2)",
    "   =SUM(A1:A2)",
    "\t@SUM(A1:A2)",
  ])(
    "neutralizes a formula-significant first meaningful character: %s",
    (value) => {
      expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
      const csv = serializeEventCsv([
        invitation({
          invitee_name: value,
          rsvps: {
            ...invitation().rsvps!,
            attendee_names: [value],
            dietary_requirements: value,
            guest_message: value,
          },
        }),
      ]);
      expect(csv).toContain(`'${value}`);
      expect(csv.split(`'${value}`).length - 1).toBe(4);
    },
  );

  it("does not alter ordinary or already apostrophe-prefixed text", () => {
    expect(neutralizeCsvFormula("normal text")).toBe("normal text");
    expect(neutralizeCsvFormula("'normal text")).toBe("'normal text");
  });

  it("sanitizes Event-derived filenames", () => {
    expect(csvFilename("Wedding Dinner")).toBe("wedding-dinner-rsvp.csv");
    expect(csvFilename("../\\=SUM(A1)\n🌸")).toBe("sum-a1-rsvp.csv");
    expect(csvFilename("店内")).toBe("event-rsvp.csv");
    expect(csvFilename(null)).toBe("event-rsvp.csv");
  });
});
