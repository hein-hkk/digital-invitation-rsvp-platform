import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { resolveOrganizerSession } from "@/server/auth/session";
import { logger } from "@/server/observability/logger";
import { createServiceRoleSupabaseClient } from "@/server/supabase/service-role";
import {
  allowGuestInvitationRead,
  allowGuestRsvp,
  allowOrganizerHighImpact,
  allowOrganizerOtp,
} from "@/server/rate-limit";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ resolveOrganizerSession: vi.fn() }));
vi.mock("@/server/supabase/service-role", () => ({
  createServiceRoleSupabaseClient: vi.fn(),
}));

const rpc = vi.fn();

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-secret");
  rpc.mockResolvedValue({ data: true, error: null });
  vi.mocked(createServiceRoleSupabaseClient).mockReturnValue({ rpc } as never);
  vi.mocked(headers).mockResolvedValue(
    new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }) as never,
  );
  vi.mocked(resolveOrganizerSession).mockResolvedValue({
    user: { id: "00000000-0000-4000-8000-000000000001" },
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("M14 server-only rate-limit categories", () => {
  it("uses separate network and Token buckets without storing raw values", async () => {
    const token = "SYNTHETIC_PRIVATE_TOKEN";
    const allowed = await allowGuestInvitationRead(
      token,
      new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }),
    );
    expect(allowed).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map((call) => call[1].p_max_attempts)).toEqual([
      120, 60,
    ]);
    for (const call of rpc.mock.calls) {
      expect(call[1].p_bucket_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(call[1])).not.toContain(token);
      expect(JSON.stringify(call[1])).not.toContain("203.0.113.7");
    }
  });

  it("applies approved RSVP and normalized OTP buckets", async () => {
    await expect(allowGuestRsvp("SYNTHETIC_PRIVATE_TOKEN")).resolves.toBe(true);
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_max_attempts: 20,
      p_window_seconds: 600,
    });
    rpc.mockClear();
    await allowOrganizerOtp("Organizer@Example.Test");
    const originalEmailBucket = rpc.mock.calls[1][1].p_bucket_hash;
    expect(rpc.mock.calls.map((call) => call[1].p_max_attempts)).toEqual([
      20, 5,
    ]);
    rpc.mockClear();
    await allowOrganizerOtp("organizer@example.test");
    expect(rpc.mock.calls[1][1].p_bucket_hash).toBe(originalEmailBucket);
  });

  it("shares the Organizer high-impact budget and fails closed", async () => {
    const log = vi.spyOn(logger, "log").mockImplementation(() => {});
    await allowOrganizerHighImpact("tokenRegeneration");
    const firstHash = rpc.mock.calls[0][1].p_bucket_hash;
    rpc.mockClear();
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(allowOrganizerHighImpact("heroUpload")).resolves.toBe(false);
    expect(rpc.mock.calls[0][1].p_bucket_hash).toBe(firstHash);
    expect(rpc.mock.calls[0][1].p_max_attempts).toBe(30);
    expect(log).toHaveBeenCalledWith("warn", {
      operation: "rateLimit",
      errorCode: "heroUpload",
      status: "failure",
    });
    rpc.mockResolvedValue({ data: null, error: { message: "synthetic" } });
    await expect(allowGuestRsvp("synthetic")).rejects.toThrow(
      "Rate-limit backend unavailable",
    );
  });
});
