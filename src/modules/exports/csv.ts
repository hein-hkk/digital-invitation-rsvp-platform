import "server-only";

export const csvHeaders = [
  "Invitee Name",
  "RSVP Status",
  "Maximum Party Size",
  "Attendee Count",
  "Attendee Names",
  "Dietary Requirements",
  "Guest Message",
  "Responded At",
  "Updated At",
] as const;

export type CsvInvitation = {
  invitee_name: string;
  maximum_party_size: number;
  rsvps: {
    status: "awaiting_response" | "attending" | "declined";
    attendee_count: number;
    attendee_names: string[];
    dietary_requirements: string | null;
    guest_message: string | null;
    responded_at: string | null;
    response_updated_at: string | null;
  } | null;
};

export function neutralizeCsvFormula(value: string): string {
  return /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null): string {
  const text = neutralizeCsvFormula(value === null ? "" : String(value));
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function statusLabel(
  status: NonNullable<CsvInvitation["rsvps"]>["status"],
): string {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Declined";
  return "Awaiting Response";
}

export function serializeEventCsv(invitations: CsvInvitation[]): string {
  const lines = [csvHeaders.join(",")];
  for (const invitation of invitations) {
    const rsvp = invitation.rsvps;
    const attending = rsvp?.status === "attending";
    const fields = [
      invitation.invitee_name,
      statusLabel(rsvp?.status ?? "awaiting_response"),
      invitation.maximum_party_size,
      attending ? rsvp.attendee_count : 0,
      attending ? rsvp.attendee_names.join("; ") : "",
      attending ? rsvp.dietary_requirements : "",
      rsvp?.guest_message ?? "",
      rsvp?.responded_at ?? "",
      rsvp?.response_updated_at ?? "",
    ];
    lines.push(fields.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function csvFilename(eventTitle: string | null): string {
  const safeName = (eventTitle ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 64)
    .replace(/-+$/gu, "")
    .toLowerCase();
  return `${safeName || "event"}-rsvp.csv`;
}
