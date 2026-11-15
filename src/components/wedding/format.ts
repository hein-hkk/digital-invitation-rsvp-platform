// Presentation-only formatting for the curated wedding theme. Event-local
// values are rendered as stored wall-clock values, never in the server zone.

function utcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDate(date));
}

export type DateParts = {
  weekday: string;
  month: string;
  day: string;
  year: string;
};

export function dateParts(date: string): DateParts {
  const parts = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(utcDate(date));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: value("weekday"),
    month: value("month"),
    day: value("day"),
    year: value("year"),
  };
}

export function timeLabel(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function timeRangeLabel(start: string, end: string | null): string {
  return end ? `${timeLabel(start)} – ${timeLabel(end)}` : timeLabel(start);
}

export function deadlineLabel(deadline: string): string {
  const [date, time] = deadline.split("T");
  return `${dateLabel(date)} at ${timeLabel(time)}`;
}

export type HostNamePart = { type: "name" | "joiner"; value: string };

/** Host Display Names joined for display without changing the stored values. */
export function hostNameParts(names: string[]): HostNamePart[] {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" })
    .formatToParts(names)
    .map((part) => ({
      type: part.type === "element" ? "name" : "joiner",
      value: part.value,
    }));
}

/** First visible character of up to two Host Display Names. */
export function monogramInitials(names: string[]): string[] {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return names
    .slice(0, 2)
    .map((name) => {
      const first = segmenter.segment(name.trim())[Symbol.iterator]().next();
      return first.done ? "" : first.value.segment.toUpperCase();
    })
    .filter(Boolean);
}
