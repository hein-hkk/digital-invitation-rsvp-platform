import { describe, expect, it } from "vitest";
import { productionClock, type Clock } from "./clock";

describe("UT-M1 Clock boundary", () => {
  it("exposes a real Date and accepts a fixed clock for later domain tests", () => {
    expect(productionClock.now()).toBeInstanceOf(Date);
    const fixedInstant = new Date("2026-01-01T00:00:00.000Z");
    const fixedClock: Clock = { now: () => fixedInstant };
    expect(fixedClock.now()).toEqual(fixedInstant);
  });
});
