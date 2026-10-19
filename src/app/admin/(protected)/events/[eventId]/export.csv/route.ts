import { ExportServiceError, exportEventCsv } from "@/modules/exports/service";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const { csv, filename } = await exportEventCsv(eventId);
    return new Response(csv, {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ExportServiceError) {
      if (error.code === "AUTH_REQUIRED") {
        return new Response("Organizer authentication required.", {
          status: 401,
          headers: privateHeaders,
        });
      }
      if (error.code === "EVENT_NOT_FOUND") {
        return new Response("Event unavailable.", {
          status: 404,
          headers: privateHeaders,
        });
      }
    }
    logger.log("error", {
      operation: "export_event_csv",
      errorCode: "EXPORT_FAILED",
      status: "failure",
    });
    return new Response("We couldn't export the CSV. Please try again.", {
      status: 500,
      headers: privateHeaders,
    });
  }
}
