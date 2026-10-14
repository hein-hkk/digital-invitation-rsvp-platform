import "server-only";

export type LogLevel = "info" | "warn" | "error";

export interface SafeLogEntry {
  operation: string;
  correlationId?: string;
  eventId?: string;
  invitationId?: string;
  organizerId?: string;
  errorCode?: string;
  status?: "success" | "failure";
  latencyMs?: number;
}

export interface Logger {
  log(level: LogLevel, entry: SafeLogEntry): void;
}

const safeCode = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const safeId = /^[a-zA-Z0-9_-]{1,64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strict allow-list: arbitrary request, error, URL, and personal-data fields cannot be logged. */
export const logger: Logger = {
  log(level, entry) {
    if (!safeCode.test(entry.operation))
      throw new Error("Unsafe log operation");
    if (entry.errorCode && !safeCode.test(entry.errorCode))
      throw new Error("Unsafe log error code");
    if (entry.correlationId && !safeId.test(entry.correlationId)) {
      throw new Error("Unsafe log correlation ID");
    }
    for (const id of [entry.eventId, entry.invitationId, entry.organizerId]) {
      if (id && !uuid.test(id)) throw new Error("Unsafe log identifier");
    }
    if (
      entry.latencyMs !== undefined &&
      (!Number.isFinite(entry.latencyMs) || entry.latencyMs < 0)
    ) {
      throw new Error("Unsafe log latency");
    }

    const record = {
      level,
      operation: entry.operation,
      correlationId: entry.correlationId,
      eventId: entry.eventId,
      invitationId: entry.invitationId,
      organizerId: entry.organizerId,
      errorCode: entry.errorCode,
      status:
        entry.status === "success" || entry.status === "failure"
          ? entry.status
          : undefined,
      latencyMs: entry.latencyMs,
    };
    const output = JSON.stringify(record);
    if (level === "error") console.error(output);
    else if (level === "warn") console.warn(output);
    else console.info(output);
  },
};
