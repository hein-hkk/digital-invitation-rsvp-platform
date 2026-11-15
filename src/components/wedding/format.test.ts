import { describe, expect, it } from "vitest";
import {
  dateLabel,
  dateParts,
  deadlineLabel,
  hostNameParts,
  monogramInitials,
  timeRangeLabel,
} from "./format";

describe("wedding presentation formatting", () => {
  it("renders the Event-local date without shifting it into another zone", () => {
    expect(dateLabel("2026-11-29")).toBe("Sunday, November 29, 2026");
    expect(dateParts("2026-11-29")).toEqual({
      weekday: "Sunday",
      month: "November",
      day: "29",
      year: "2026",
    });
  });

  it("renders a start time alone or as a range", () => {
    expect(timeRangeLabel("18:00:00", null)).toBe("6:00 PM");
    expect(timeRangeLabel("18:00", "20:30")).toBe("6:00 PM – 8:30 PM");
    expect(deadlineLabel("2026-11-25T12:00:00")).toBe(
      "Wednesday, November 25, 2026 at 12:00 PM",
    );
  });

  it("keeps Host Display Names readable as one natural sentence", () => {
    const text = (names: string[]) =>
      hostNameParts(names)
        .map((part) => part.value)
        .join("");
    expect(text(["Alex"])).toBe("Alex");
    expect(text(["Alex", "Sam"])).toBe("Alex and Sam");
    expect(text(["Alex", "Sam", "Kim"])).toBe("Alex, Sam, and Kim");
    expect(hostNameParts(["Alex", "Sam"]).map((part) => part.type)).toEqual([
      "name",
      "joiner",
      "name",
    ]);
  });

  it("builds a monogram from at most two hosts", () => {
    expect(monogramInitials(["hein", " Nway ", "Kim"])).toEqual(["H", "N"]);
    expect(monogramInitials(["နွေး"])).toHaveLength(1);
    expect(monogramInitials(["  "])).toEqual([]);
  });
});
