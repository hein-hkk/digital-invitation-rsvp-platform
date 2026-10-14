import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicSupabaseEnv, getServiceRoleEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("UT-M1 environment validation", () => {
  it("rejects missing server credentials when a privileged client is requested", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(getPublicSupabaseEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(
      "http://127.0.0.1:54321",
    );
    expect(() => getServiceRoleEnv()).toThrow();
  });

  it("rejects a malformed Supabase URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-anon-key");

    expect(() => getPublicSupabaseEnv()).toThrow();
  });
});
