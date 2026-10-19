import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveOrganizerSession } from "@/server/auth/session";
import { createAuthenticatedSupabaseClient } from "@/server/supabase/authenticated";
import type { Database } from "@/types/database.types";
import { csvFilename, serializeEventCsv, type CsvInvitation } from "./csv";

export type ExportErrorCode =
  "AUTH_REQUIRED" | "EVENT_NOT_FOUND" | "EXPORT_FAILED";

export class ExportServiceError extends Error {
  constructor(readonly code: ExportErrorCode) {
    super(code);
  }
}

export function createExportOperations(context: {
  client: SupabaseClient<Database>;
  organizerId: string;
  pageSize?: number;
}) {
  const { client, organizerId } = context;
  const pageSize = Math.min(500, Math.max(1, context.pageSize ?? 500));
  return {
    async exportEventCsv(eventId: string) {
      if (!z.uuid().safeParse(eventId).success) {
        throw new ExportServiceError("EVENT_NOT_FOUND");
      }
      const { data: event, error: eventError } = await client
        .from("events")
        .select("event_title")
        .eq("id", eventId)
        .eq("owner_user_id", organizerId)
        .maybeSingle();
      if (eventError) throw new ExportServiceError("EXPORT_FAILED");
      if (!event) throw new ExportServiceError("EVENT_NOT_FOUND");

      const invitations: CsvInvitation[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("invitations")
          .select(
            "invitee_name,maximum_party_size,rsvps(status,attendee_count,attendee_names,dietary_requirements,guest_message,responded_at,response_updated_at)",
          )
          .eq("event_id", eventId)
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error || !data) throw new ExportServiceError("EXPORT_FAILED");
        invitations.push(...data);
        if (data.length < pageSize) break;
      }
      return {
        csv: serializeEventCsv(invitations),
        filename: csvFilename(event.event_title),
      };
    },
  };
}

export async function exportEventCsv(eventId: string) {
  const session = await resolveOrganizerSession();
  if (!session) throw new ExportServiceError("AUTH_REQUIRED");
  const { client, user } = await createAuthenticatedSupabaseClient(
    session.accessToken,
  );
  return createExportOperations({
    client,
    organizerId: user.id,
  }).exportEventCsv(eventId);
}
