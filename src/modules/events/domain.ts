import type { Clock } from "@/server/time/clock";

export type PublicationStatus = "draft" | "published";
export type EventRuntimeState = PublicationStatus | "ended";

export type EventTiming = {
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  eventTimezone: string | null;
  rsvpDeadlineLocal: string | null;
};

export type EventForRuntime = Pick<
  EventTiming,
  "eventDate" | "endTime" | "eventTimezone"
> & { publicationStatus: PublicationStatus };

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let current = formatters.get(timeZone);
  if (!current) {
    current = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, current);
  }
  return current;
}

export function isValidEventTimezone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function parseDate(value: string): Pick<LocalParts, "year" | "month" | "day"> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Invalid Event Date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Invalid Event Date");
  }
  return { year, month, day };
}

function parseTime(
  value: string,
): Pick<LocalParts, "hour" | "minute" | "second"> {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError("Invalid Event time");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new RangeError("Invalid Event time");
  }
  return { hour, minute, second };
}

function parseLocalDateTime(value: string): LocalParts {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(value);
  if (!match) throw new RangeError("Invalid local date/time");
  return { ...parseDate(match[1]), ...parseTime(match[2]) };
}

function wallParts(instant: number, timeZone: string): LocalParts {
  const fields = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: fields.year,
    month: fields.month,
    day: fields.day,
    hour: fields.hour,
    minute: fields.minute,
    second: fields.second,
  };
}

function utcFromParts(parts: LocalParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** Interpret an Event-local wall time using the IANA timezone, including DST transitions. */
export function eventLocalToInstant(value: string, timeZone: string): Date {
  const target = parseLocalDateTime(value);
  const wallAsUtc = utcFromParts(target);
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const instant = wallAsUtc + hours * 3_600_000;
    offsets.add(utcFromParts(wallParts(instant, timeZone)) - instant);
  }
  const possibilities = [...offsets].map((offset) => wallAsUtc - offset);
  const exact = possibilities.filter(
    (instant) => utcFromParts(wallParts(instant, timeZone)) === wallAsUtc,
  );
  if (exact.length > 0) {
    // PostgreSQL's AT TIME ZONE resolves repeated fall-back wall times to
    // standard time, the later of the two possible instants.
    return new Date(Math.max(...exact));
  }
  // During a spring-forward gap, PostgreSQL interprets the time with the
  // pre-transition offset, advancing the resulting wall time past the gap.
  const afterGap = possibilities
    .filter((instant) => utcFromParts(wallParts(instant, timeZone)) > wallAsUtc)
    .sort((a, b) => a - b);
  if (afterGap.length > 0) return new Date(afterGap[0]);
  throw new RangeError(
    "Local date/time cannot be interpreted in Event Timezone",
  );
}

export function getEventExpirationAt(
  event: Pick<EventTiming, "eventDate" | "endTime" | "eventTimezone">,
): Date {
  if (!event.eventDate || !event.eventTimezone) {
    throw new RangeError(
      "Published Event requires Event Date and Event Timezone",
    );
  }
  if (event.endTime) {
    return eventLocalToInstant(
      `${event.eventDate}T${event.endTime}`,
      event.eventTimezone,
    );
  }
  const date = parseDate(event.eventDate);
  const nextDay = new Date(Date.UTC(date.year, date.month - 1, date.day + 1))
    .toISOString()
    .slice(0, 10);
  return eventLocalToInstant(`${nextDay}T00:00:00`, event.eventTimezone);
}

export function getEventRuntimeState(
  event: EventForRuntime,
  clock: Clock,
): EventRuntimeState {
  if (event.publicationStatus === "draft") return "draft";
  return clock.now().getTime() >= getEventExpirationAt(event).getTime()
    ? "ended"
    : "published";
}

export function assertEventMutable(event: EventForRuntime, clock: Clock): void {
  if (getEventRuntimeState(event, clock) === "ended") {
    throw new Error("EVENT_NOT_MUTABLE");
  }
}

export function isEventDeletable(
  event: EventForRuntime,
  clock: Clock,
): boolean {
  return getEventRuntimeState(event, clock) !== "published";
}

export function validateEventTiming(
  event: EventTiming,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (event.eventDate) {
    try {
      parseDate(event.eventDate);
    } catch {
      errors.eventDate = "Enter a valid Event Date.";
    }
  }
  for (const key of ["startTime", "endTime"] as const) {
    if (event[key]) {
      try {
        parseTime(event[key]);
      } catch {
        errors[key] = "Enter a valid Event time.";
      }
    }
  }
  if (event.eventTimezone && !isValidEventTimezone(event.eventTimezone)) {
    errors.eventTimezone = "Enter a valid IANA Event Timezone.";
  }
  if (event.rsvpDeadlineLocal) {
    try {
      parseLocalDateTime(event.rsvpDeadlineLocal);
    } catch {
      errors.rsvpDeadlineLocal = "Enter a valid RSVP Deadline.";
    }
  }
  if (
    event.startTime &&
    event.endTime &&
    !errors.startTime &&
    !errors.endTime &&
    utcFromParts({ ...parseDate("2000-01-01"), ...parseTime(event.endTime) }) <=
      utcFromParts({
        ...parseDate("2000-01-01"),
        ...parseTime(event.startTime),
      })
  ) {
    errors.endTime = "End Time must be later than Start Time.";
  }
  if (
    event.eventDate &&
    event.startTime &&
    event.rsvpDeadlineLocal &&
    !errors.eventDate &&
    !errors.startTime &&
    !errors.rsvpDeadlineLocal &&
    utcFromParts(parseLocalDateTime(event.rsvpDeadlineLocal)) >=
      utcFromParts(parseLocalDateTime(`${event.eventDate}T${event.startTime}`))
  ) {
    errors.rsvpDeadlineLocal = "RSVP Deadline must be before Event Start.";
  }
  return errors;
}

export type PublicationFields = EventTiming & {
  eventType: string | null;
  eventTitle: string | null;
  hostDisplayNames: string[];
  venueName: string | null;
  venueAddress: string | null;
};

export function validatePublication(
  event: PublicationFields,
): Record<string, string> {
  const errors = validateEventTiming(event);
  if (event.eventType !== "wedding")
    errors.eventType = "Event Type is required.";
  if (!event.eventTitle?.trim()) errors.eventTitle = "Event Title is required.";
  if (
    event.hostDisplayNames.length === 0 ||
    event.hostDisplayNames.some((name) => !name.trim())
  ) {
    errors.hostDisplayNames = "At least one Host Display Name is required.";
  }
  if (!event.eventDate) errors.eventDate = "Event Date is required.";
  if (!event.startTime) errors.startTime = "Start Time is required.";
  if (!event.eventTimezone)
    errors.eventTimezone = "Event Timezone is required.";
  if (!event.venueName?.trim()) errors.venueName = "Venue Name is required.";
  if (!event.venueAddress?.trim())
    errors.venueAddress = "Venue Address is required.";
  return errors;
}
