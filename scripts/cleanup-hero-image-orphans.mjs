import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const bucketName = "hero-images";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const graceMs = 24 * 60 * 60 * 1000;

/** Scan first, then delete only old objects still unreferenced at cleanup time. */
export async function cleanupHeroImageOrphans({
  client,
  dryRun = true,
  now = new Date(),
  minimumAgeMs = graceMs,
  onlyEventIds,
}) {
  const bucketDetails = await client.storage.getBucket(bucketName);
  if (bucketDetails.error || !bucketDetails.data || bucketDetails.data.public) {
    throw new Error("Private Hero Image bucket unavailable");
  }
  const bucket = client.storage.from(bucketName);
  const candidates = [];
  let scanned = 0;
  let skippedRecent = 0;
  const pageSize = 100;

  for (let folderOffset = 0; ; folderOffset += pageSize) {
    const folders = await bucket.list("", {
      limit: pageSize,
      offset: folderOffset,
    });
    if (folders.error) throw new Error("Hero Image listing failed");
    for (const folder of folders.data ?? []) {
      if (!uuid.test(folder.name)) continue;
      const eventId = folder.name;
      if (onlyEventIds && !onlyEventIds.includes(eventId)) continue;
      const reference = await client
        .from("events")
        .select("hero_image_storage_path")
        .eq("id", eventId)
        .maybeSingle();
      if (reference.error)
        throw new Error("Hero Image reference lookup failed");
      for (let objectOffset = 0; ; objectOffset += pageSize) {
        const listed = await bucket.list(eventId, {
          limit: pageSize,
          offset: objectOffset,
        });
        if (listed.error) throw new Error("Hero Image listing failed");
        for (const object of listed.data ?? []) {
          if (!object.id) continue;
          scanned += 1;
          const path = `${eventId}/${object.name}`;
          if (path === reference.data?.hero_image_storage_path) continue;
          const modifiedAt = Date.parse(
            object.updated_at ?? object.created_at ?? "",
          );
          if (
            !Number.isFinite(modifiedAt) ||
            now.getTime() - modifiedAt < minimumAgeMs
          ) {
            skippedRecent += 1;
            continue;
          }
          candidates.push({ eventId, path });
        }
        if ((listed.data?.length ?? 0) < pageSize) break;
      }
    }
    if ((folders.data?.length ?? 0) < pageSize) break;
  }

  let removed = 0;
  let failed = 0;
  if (!dryRun) {
    for (const candidate of candidates) {
      const current = await client
        .from("events")
        .select("hero_image_storage_path")
        .eq("id", candidate.eventId)
        .maybeSingle();
      if (current.error) throw new Error("Hero Image reference lookup failed");
      if (current.data?.hero_image_storage_path === candidate.path) continue;
      try {
        const result = await bucket.remove([candidate.path]);
        if (result.error) failed += 1;
        else removed += 1;
      } catch {
        failed += 1;
      }
    }
  }
  return {
    scanned,
    candidates: candidates.length,
    skippedRecent,
    removed,
    failed,
  };
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  if (flags.has("--help")) {
    process.stdout.write(
      "Usage: node scripts/cleanup-hero-image-orphans.mjs [--local] [--dry-run | --delete]\n",
    );
    return;
  }
  if (
    [...flags].some(
      (flag) => !["--local", "--dry-run", "--delete"].includes(flag),
    ) ||
    (flags.has("--dry-run") && flags.has("--delete"))
  ) {
    throw new Error("Invalid cleanup options");
  }
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (flags.has("--local")) {
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
    throw new Error("Supabase cleanup configuration unavailable");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const dryRun = !flags.has("--delete");
  const result = await cleanupHeroImageOrphans({ client, dryRun });
  process.stdout.write(
    JSON.stringify({
      operation: "heroImageOrphanCleanup",
      mode: dryRun ? "dry-run" : "delete",
      ...result,
    }) + "\n",
  );
  if (result.failed > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch(() => {
    console.error(
      "Hero Image orphan cleanup failed. Check the private bucket and database connection.",
    );
    process.exitCode = 1;
  });
}
