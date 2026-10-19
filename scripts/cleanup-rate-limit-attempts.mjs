import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const local = process.argv.slice(2).includes("--local");
if (process.argv.slice(2).some((argument) => argument !== "--local")) {
  throw new Error(
    "Usage: node scripts/cleanup-rate-limit-attempts.mjs [--local]",
  );
}

let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (local) {
  const status = JSON.parse(
    execFileSync(
      resolve("node_modules/.bin/supabase"),
      ["status", "--output", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ),
  );
  url = status.API_URL;
  key = status.SERVICE_ROLE_KEY;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname)
  ) {
    throw new Error("Local cleanup requires loopback Supabase");
  }
}
if (!url || !key)
  throw new Error("Rate-limit cleanup configuration unavailable");

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const result = await client.rpc("purge_expired_rate_limit_attempts");
if (result.error) throw new Error("Rate-limit cleanup failed");
process.stdout.write(
  JSON.stringify({ operation: "rateLimitCleanup", removed: result.data }) +
    "\n",
);
