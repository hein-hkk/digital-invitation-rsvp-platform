import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createInvitationCredential,
  decryptInvitationToken,
  invitationUrl,
  isInvitationToken,
  tokenLookupHash,
  type InvitationTokenConfig,
} from "./invitation-credentials";

const config: InvitationTokenConfig = {
  hashKey: randomBytes(32),
  encryptionKey: randomBytes(32),
  keyVersion: 1,
  baseUrl: "https://example.test",
};

describe("Invitation Token wrapper", () => {
  it("uses 32 random bytes, URL-safe encoding, HMAC, and a distinct credential", () => {
    const first = createInvitationCredential(config);
    const second = createInvitationCredential(config);
    expect(first.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(first.rawToken, "base64url")).toHaveLength(32);
    expect(isInvitationToken(first.rawToken)).toBe(true);
    expect(isInvitationToken(first.rawToken + "x")).toBe(false);
    expect(first.lookupHash).toHaveLength(32);
    expect(first.lookupHash).toEqual(tokenLookupHash(first.rawToken, config));
    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.lookupHash).not.toEqual(second.lookupHash);
    expect(first.ciphertext).not.toContain(first.rawToken);
    expect(invitationUrl(first.rawToken, config)).toBe(
      `https://example.test/i/${first.rawToken}`,
    );
  });

  it("round-trips and rejects wrong keys, versions, or modified envelopes", () => {
    const credential = createInvitationCredential(config);
    expect(decryptInvitationToken(credential.ciphertext, 1, config)).toBe(
      credential.rawToken,
    );
    expect(() =>
      decryptInvitationToken(credential.ciphertext, 2, config),
    ).toThrow();
    expect(() =>
      decryptInvitationToken(credential.ciphertext, 1, {
        ...config,
        encryptionKey: randomBytes(32),
      }),
    ).toThrow();
    expect(() =>
      decryptInvitationToken(credential.ciphertext.slice(1), 1, config),
    ).toThrow();
  });
});
