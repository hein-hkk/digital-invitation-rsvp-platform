import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  anonymousClient,
  expireLocalOtp,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

describe("Organizer OTP with local Supabase Auth", () => {
  it("AUTH-01/02 provisioned user receives OTP and a valid code establishes a Supabase session", async () => {
    const organizer = await provisionOtpOrganizer();
    try {
      const auth = anonymousClient();
      const request = await auth.auth.signInWithOtp({
        email: organizer.email,
        options: { shouldCreateUser: false },
      });
      expect(request.error).toBeNull();
      const code = await readLatestOtp(organizer.email);
      const verified = await auth.auth.verifyOtp({
        email: organizer.email,
        token: code,
        type: "email",
      });
      expect(verified.error).toBeNull();
      expect(verified.data.session?.user.id).toBe(organizer.id);
      const user = await auth.auth.getUser(verified.data.session!.access_token);
      expect(user.data.user?.id).toBe(organizer.id);
    } finally {
      await serviceClient().auth.admin.deleteUser(organizer.id);
    }
  });

  it("AUTH-03 invalid OTP does not establish a session", async () => {
    const organizer = await provisionOtpOrganizer();
    try {
      const auth = anonymousClient();
      const requested = await auth.auth.signInWithOtp({
        email: organizer.email,
        options: { shouldCreateUser: false },
      });
      expect(requested.error).toBeNull();
      const verified = await auth.auth.verifyOtp({
        email: organizer.email,
        token: "000000",
        type: "email",
      });
      expect(verified.error).not.toBeNull();
      expect(verified.data.session).toBeNull();
    } finally {
      await serviceClient().auth.admin.deleteUser(organizer.id);
    }
  });

  it("AUTH-03 expired OTP does not establish a session", async () => {
    const organizer = await provisionOtpOrganizer();
    try {
      const auth = anonymousClient();
      const requested = await auth.auth.signInWithOtp({
        email: organizer.email,
        options: { shouldCreateUser: false },
      });
      expect(requested.error).toBeNull();
      const code = await readLatestOtp(organizer.email);
      expireLocalOtp(organizer.id);
      const verified = await auth.auth.verifyOtp({
        email: organizer.email,
        token: code,
        type: "email",
      });
      expect(verified.error).not.toBeNull();
      expect(verified.data.session).toBeNull();
    } finally {
      await serviceClient().auth.admin.deleteUser(organizer.id);
    }
  });

  it("AUTH-04 unknown email cannot create an Auth user", async () => {
    const email = `m3-unknown-${randomUUID()}@example.test`;
    const result = await anonymousClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    expect(result.data.user).toBeNull();
    const users = await serviceClient().auth.admin.listUsers({ perPage: 1000 });
    expect(users.error).toBeNull();
    expect(users.data.users.some((user) => user.email === email)).toBe(false);
  });

  it("AUTH-05 public password signup is disabled by local Auth configuration", async () => {
    const email = `m3-signup-${randomUUID()}@example.test`;
    const result = await anonymousClient().auth.signUp({
      email,
      password: `Synthetic-${randomUUID()}`,
    });
    expect(result.error).not.toBeNull();
    const users = await serviceClient().auth.admin.listUsers({ perPage: 1000 });
    expect(users.data.users.some((user) => user.email === email)).toBe(false);
  });
});
