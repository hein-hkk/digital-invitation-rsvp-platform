import { describe, expect, it } from "vitest";
import { validateInvitationValues } from "./schema";

describe("Maximum Party Size and Invitee Name", () => {
  it("accepts the inclusive 1–20 range", () => {
    for (const size of ["1", "20"]) {
      expect(
        validateInvitationValues({
          inviteeName: " Test Household ",
          maximumPartySize: size,
        }),
      ).toMatchObject({
        valid: true,
        inviteeName: "Test Household",
        maximumPartySize: Number(size),
      });
    }
  });

  it("rejects empty, noninteger, out-of-range, and blank names", () => {
    for (const size of ["", "0", "21", "1.5", "1e0", "abc"]) {
      expect(
        validateInvitationValues({
          inviteeName: "Household",
          maximumPartySize: size,
        }).fieldErrors.maximumPartySize,
      ).toBeTruthy();
    }
    expect(
      validateInvitationValues({ inviteeName: "  ", maximumPartySize: "2" })
        .fieldErrors.inviteeName,
    ).toBeTruthy();
  });
});
