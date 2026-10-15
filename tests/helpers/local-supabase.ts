import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type LocalStatus = {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
};

let cachedStatus: LocalStatus | undefined;

function localStatus(): LocalStatus {
  if (!cachedStatus) {
    const cli = join(process.cwd(), "node_modules", ".bin", "supabase");
    cachedStatus = JSON.parse(
      execFileSync(cli, ["status", "--output", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as LocalStatus;
    if (
      !cachedStatus.API_URL.startsWith("http://127.0.0.1:") ||
      !cachedStatus.ANON_KEY ||
      !cachedStatus.SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "Integration tests require an isolated local Supabase stack",
      );
    }
  }
  return cachedStatus;
}

function client(key: string, authorization?: string): SupabaseClient<Database> {
  return createClient<Database>(localStatus().API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authorization
      ? { headers: { Authorization: `Bearer ${authorization}` } }
      : undefined,
  });
}

export function serviceClient(): SupabaseClient<Database> {
  return client(localStatus().SERVICE_ROLE_KEY);
}

export function anonymousClient(): SupabaseClient<Database> {
  return client(localStatus().ANON_KEY);
}

export function localMailpitUrl(): string {
  const status = localStatus() as LocalStatus & { MAILPIT_URL?: string };
  if (!status.MAILPIT_URL?.startsWith("http://127.0.0.1:")) {
    throw new Error("Local Mailpit is required for OTP tests");
  }
  return status.MAILPIT_URL;
}

export async function provisionOtpOrganizer(): Promise<{
  id: string;
  email: string;
}> {
  const email = `m3-${randomUUID()}@example.test`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error("Cannot provision test Organizer");
  return { id: data.user.id, email };
}

export async function readLatestOtp(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`${localMailpitUrl()}/api/v1/messages`);
    if (!response.ok) throw new Error("Cannot read local Mailpit messages");
    const listing = (await response.json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const message = listing.messages.find((item) =>
      item.To.some((recipient) => recipient.Address === email),
    );
    if (message) {
      const detail = await fetch(
        `${localMailpitUrl()}/api/v1/message/${message.ID}`,
      );
      if (!detail.ok) throw new Error("Cannot read local OTP email");
      const body = (await detail.json()) as { Text: string };
      const token = body.Text.match(/\b\d{6}\b/)?.[0];
      if (!token) throw new Error("OTP code not found in local email");
      return token;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local OTP email was not delivered");
}

export function expireLocalOtp(userId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(userId))
    throw new Error("Invalid local Auth user ID");
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_digital-invitation-rsvp-platform",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-q",
      "-c",
      `UPDATE auth.users SET recovery_sent_at = NOW() - interval '2 hours' WHERE id = '${userId}'::uuid`,
    ],
    { stdio: "ignore" },
  );
}

export type OrganizerFixture = {
  id: string;
  client: SupabaseClient<Database>;
};

function localAuthenticatedJwt(userId: string): string {
  const status = localStatus();
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase-demo",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  const content = `${header}.${claims}`;
  const signature = createHmac("sha256", status.JWT_SECRET)
    .update(content)
    .digest("base64url");
  return `${content}.${signature}`;
}

export async function createOrganizer(): Promise<OrganizerFixture> {
  const email = `m2-${randomUUID()}@example.test`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error("Cannot create local Organizer");
  return {
    id: data.user.id,
    // M2 exercises RLS with real provisioned Auth users and isolated local JWTs.
    // The approved OTP sign-in flow is implemented and tested in M3.
    client: client(localStatus().ANON_KEY, localAuthenticatedJwt(data.user.id)),
  };
}

export async function createDraftEvent(
  organizer: OrganizerFixture,
  values: Database["public"]["Tables"]["events"]["Insert"] = {
    owner_user_id: organizer.id,
  },
): Promise<string> {
  const { data, error } = await organizer.client
    .from("events")
    .insert({ ...values, owner_user_id: organizer.id })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Cannot create local Event");
  return data.id;
}

export function syntheticHash(label: string): string {
  return `\\x${createHash("sha256").update(label).digest("hex")}`;
}

export async function createInvitation(
  organizer: OrganizerFixture,
  eventId: string,
  label: string,
  maximumPartySize = 3,
): Promise<string> {
  const { data, error } = await serviceClient().rpc(
    "create_invitation_record",
    {
      p_owner_user_id: organizer.id,
      p_event_id: eventId,
      p_invitee_name: label,
      p_maximum_party_size: maximumPartySize,
      p_token_lookup_hash: syntheticHash(`${eventId}:${label}`),
      p_token_ciphertext: `synthetic-test-envelope-${randomUUID()}`,
      p_token_key_version: 1,
    },
  );
  if (error || !data)
    throw error ?? new Error("Cannot create local Invitation");
  return data;
}

export async function cleanupOrganizers(
  organizers: OrganizerFixture[],
): Promise<void> {
  const service = serviceClient();
  for (const organizer of organizers) {
    // Test data only: move active synthetic Events into the past before the
    // approved Draft/Ended deletion path cleans them up.
    await service
      .from("events")
      .update({ event_date: "2000-01-01", rsvp_deadline_local: null })
      .eq("owner_user_id", organizer.id)
      .eq("publication_status", "published");
    const deletion = await service
      .from("events")
      .delete()
      .eq("owner_user_id", organizer.id);
    if (deletion.error) throw deletion.error;
    const authDeletion = await service.auth.admin.deleteUser(organizer.id);
    if (authDeletion.error) throw authDeletion.error;
  }
}
