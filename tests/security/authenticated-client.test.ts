import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-anon-key");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("SEC-M1 authenticated Supabase boundary", () => {
  it("rejects an unverified access token", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "invalid" },
    });
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser },
    } as unknown as ReturnType<typeof createClient>);

    await expect(
      createAuthenticatedSupabaseClient("synthetic-invalid-token"),
    ).rejects.toThrow("Organizer authentication required");
    expect(getUser).toHaveBeenCalledWith("synthetic-invalid-token");
  });

  it("uses the verified token for an RLS-scoped client", async () => {
    const user = { id: "00000000-0000-4000-8000-000000000001" };
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    } as unknown as ReturnType<typeof createClient>;
    vi.mocked(createClient).mockReturnValue(client);

    await expect(
      createAuthenticatedSupabaseClient("synthetic-valid-token"),
    ).resolves.toEqual({
      client,
      user,
    });
    expect(createClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "local-anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer synthetic-valid-token" } },
      }),
    );
  });
});
