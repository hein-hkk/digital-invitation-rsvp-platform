import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/server/observability/logger";

afterEach(() => vi.restoreAllMocks());

describe("SEC-M1 safe logger", () => {
  it("emits only allow-listed metadata", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.log("info", {
      operation: "foundation_boot",
      status: "success",
      token: "private-token",
    } as Parameters<typeof logger.log>[1] & { token: string });

    expect(output).toHaveBeenCalledOnce();
    expect(output.mock.calls[0]?.[0]).toBe(
      JSON.stringify({
        level: "info",
        operation: "foundation_boot",
        status: "success",
      }),
    );
  });

  it("rejects URL-shaped operation values", () => {
    expect(() => logger.log("info", { operation: "/i/private-token" })).toThrow(
      "Unsafe log operation",
    );
  });

  it("redacts invitation Token material even when supplied as extra metadata", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => {});
    const privateToken = "SYNTHETIC_PRIVATE_TOKEN";
    logger.log("warn", {
      operation: "regenerate_invitation_token",
      status: "failure",
      errorCode: "INVITATION_PERSISTENCE_ERROR",
      url: `https://example.test/i/${privateToken}`,
      rawToken: privateToken,
      lookupHash: privateToken,
      ciphertext: privateToken,
    } as Parameters<typeof logger.log>[1] & Record<string, string>);
    const record = String(output.mock.calls[0]?.[0]);
    expect(record).not.toContain(privateToken);
    expect(record).not.toContain("url");
    expect(record).not.toContain("lookupHash");
    expect(record).toContain("INVITATION_PERSISTENCE_ERROR");
  });
});
