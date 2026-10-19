import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { anonymousClient, serviceClient } from "../helpers/local-supabase";

function bucket() {
  return createHash("sha256").update(randomUUID()).digest("hex");
}

describe("M14 rolling rate-limit storage", () => {
  it("admits only the configured number of concurrent attempts", async () => {
    const key = bucket();
    const client = serviceClient();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        client.rpc("consume_rate_limit", {
          p_bucket_hash: key,
          p_max_attempts: 2,
          p_window_seconds: 60,
        }),
      ),
    );
    expect(results.every((result) => result.error === null)).toBe(true);
    expect(results.filter((result) => result.data === true)).toHaveLength(2);
    expect(results.filter((result) => result.data === false)).toHaveLength(6);
  });

  it("expires the rolling window and rejects browser roles and invalid configuration", async () => {
    const key = bucket();
    const service = serviceClient();
    const args = {
      p_bucket_hash: key,
      p_max_attempts: 1,
      p_window_seconds: 1,
    };
    expect((await service.rpc("consume_rate_limit", args)).data).toBe(true);
    expect((await service.rpc("consume_rate_limit", args)).data).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect((await service.rpc("consume_rate_limit", args)).data).toBe(true);
    expect(
      (await anonymousClient().rpc("consume_rate_limit", args)).error,
    ).not.toBeNull();
    expect(
      (
        await service.rpc("consume_rate_limit", {
          ...args,
          p_max_attempts: -1,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await anonymousClient().rpc("purge_expired_rate_limit_attempts")).error,
    ).not.toBeNull();
    const cleanup = await service.rpc("purge_expired_rate_limit_attempts");
    expect(cleanup.error).toBeNull();
    expect(cleanup.data).toBeGreaterThanOrEqual(0);
  });
});
