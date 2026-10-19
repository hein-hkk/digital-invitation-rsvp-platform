import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

export function cleanupHeroImageOrphans(input: {
  client: SupabaseClient<Database>;
  dryRun?: boolean;
  now?: Date;
  minimumAgeMs?: number;
  onlyEventIds?: string[];
}): Promise<{
  scanned: number;
  candidates: number;
  skippedRecent: number;
  removed: number;
  failed: number;
}>;
