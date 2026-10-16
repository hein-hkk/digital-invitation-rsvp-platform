import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getInvitationSecurityEnv } from "@/server/env";

export type InvitationTokenConfig = {
  hashKey: Buffer;
  encryptionKey: Buffer;
  keyVersion: 1;
  baseUrl: string;
};

function decodeKey(value: string, name: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error(`${name} must be a base64url-encoded 32-byte key`);
  }
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== value) {
    throw new Error(`${name} must be a base64url-encoded 32-byte key`);
  }
  return key;
}

export function loadInvitationTokenConfig(): InvitationTokenConfig {
  const env = getInvitationSecurityEnv();
  const hashKey = decodeKey(env.INVITATION_TOKEN_HASH_KEY, "Token hash key");
  const encryptionKey = decodeKey(
    env.INVITATION_TOKEN_ENCRYPTION_KEY_V1,
    "Token encryption key",
  );
  if (timingSafeEqual(hashKey, encryptionKey)) {
    throw new Error("Token hash and encryption keys must differ");
  }
  const origin = new URL(env.APP_BASE_URL);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname)
      ))
  ) {
    throw new Error(
      "APP_BASE_URL must be an HTTPS origin or local HTTP origin",
    );
  }
  return {
    hashKey,
    encryptionKey,
    keyVersion: 1,
    baseUrl: origin.origin,
  };
}

export function isInvitationToken(value: string): boolean {
  return (
    /^[A-Za-z0-9_-]{43}$/.test(value) &&
    Buffer.from(value, "base64url").length === 32 &&
    Buffer.from(value, "base64url").toString("base64url") === value
  );
}

export function tokenLookupHash(
  rawToken: string,
  config: InvitationTokenConfig,
) {
  if (!isInvitationToken(rawToken)) throw new Error("Invalid Invitation Token");
  return createHmac("sha256", config.hashKey).update(rawToken).digest();
}

export function invitationUrl(rawToken: string, config: InvitationTokenConfig) {
  if (!isInvitationToken(rawToken)) throw new Error("Invalid Invitation Token");
  return new URL(`/i/${rawToken}`, config.baseUrl).toString();
}

export function createInvitationCredential(config: InvitationTokenConfig) {
  const rawToken = randomBytes(32).toString("base64url");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    rawToken,
    lookupHash: tokenLookupHash(rawToken, config),
    ciphertext: `v1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`,
    keyVersion: config.keyVersion,
  };
}

export function decryptInvitationToken(
  envelope: string,
  keyVersion: number,
  config: InvitationTokenConfig,
): string {
  if (keyVersion !== config.keyVersion)
    throw new Error("Unknown Token key version");
  const match =
    /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{58})\.([A-Za-z0-9_-]{22})$/.exec(
      envelope,
    );
  if (!match) throw new Error("Invalid Token envelope");
  const iv = Buffer.from(match[1], "base64url");
  const ciphertext = Buffer.from(match[2], "base64url");
  const tag = Buffer.from(match[3], "base64url");
  if (iv.length !== 12 || ciphertext.length !== 43 || tag.length !== 16) {
    throw new Error("Invalid Token envelope");
  }
  const decipher = createDecipheriv("aes-256-gcm", config.encryptionKey, iv);
  decipher.setAuthTag(tag);
  const token = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  if (!isInvitationToken(token)) throw new Error("Invalid decrypted Token");
  return token;
}
