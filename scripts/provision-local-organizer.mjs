import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: pnpm auth:provision:local organizer@example.test");
  process.exitCode = 1;
} else {
  try {
    const status = JSON.parse(
      execFileSync(
        resolve("node_modules/.bin/supabase"),
        ["status", "--output", "json"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      ),
    );
    const url = new URL(status.API_URL);
    if (
      url.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(url.hostname)
    ) {
      throw new Error(
        "Only local Supabase provisioning is supported by this helper",
      );
    }
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw new Error("Local Organizer provisioning failed");
    console.log(
      "Local Organizer provisioned. Use the sign-in page to request an OTP.",
    );
  } catch {
    console.error(
      "Local Organizer provisioning failed. Check local Supabase and the email address.",
    );
    process.exitCode = 1;
  }
}
