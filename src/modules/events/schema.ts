import { z } from "zod";
import type { Database } from "@/types/database.types";
import {
  validateEventTiming,
  validatePublication,
  type PublicationFields,
} from "./domain";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventValues = PublicationFields & {
  venueMapUrl: string | null;
  dressCode: string | null;
  invitationMessage: string | null;
  venueArrivalNotes: string | null;
  organizerContactInformation: string | null;
};

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || null);

export const emptyEventValues: EventValues = {
  eventType: null,
  eventTitle: null,
  hostDisplayNames: [],
  eventDate: null,
  startTime: null,
  endTime: null,
  eventTimezone: null,
  rsvpDeadlineLocal: null,
  venueName: null,
  venueAddress: null,
  venueMapUrl: null,
  dressCode: null,
  invitationMessage: null,
  venueArrivalNotes: null,
  organizerContactInformation: null,
};

export function eventValuesFromRow(row: EventRow): EventValues {
  return {
    eventType: row.event_type,
    eventTitle: row.event_title,
    hostDisplayNames: row.host_display_names,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    eventTimezone: row.event_timezone,
    rsvpDeadlineLocal: row.rsvp_deadline_local,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    venueMapUrl: row.venue_map_url,
    dressCode: row.dress_code,
    invitationMessage: row.invitation_message,
    venueArrivalNotes: row.venue_arrival_notes,
    organizerContactInformation: row.organizer_contact_information,
  };
}

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? optionalText.parse(value) : null;
}

export function eventValuesFromForm(form: FormData): EventValues {
  return {
    eventType: field(form, "eventType"),
    eventTitle: field(form, "eventTitle"),
    hostDisplayNames: (field(form, "hostDisplayNames") ?? "")
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean),
    eventDate: field(form, "eventDate"),
    startTime: field(form, "startTime"),
    endTime: field(form, "endTime"),
    eventTimezone: field(form, "eventTimezone"),
    rsvpDeadlineLocal: field(form, "rsvpDeadlineLocal"),
    venueName: field(form, "venueName"),
    venueAddress: field(form, "venueAddress"),
    venueMapUrl: field(form, "venueMapUrl"),
    dressCode: field(form, "dressCode"),
    invitationMessage: field(form, "invitationMessage"),
    venueArrivalNotes: field(form, "venueArrivalNotes"),
    organizerContactInformation: field(form, "organizerContactInformation"),
  };
}

export function validateEventValues(values: EventValues, published: boolean) {
  const errors = published
    ? validatePublication(values)
    : validateEventTiming(values);
  if (values.eventType && values.eventType !== "wedding") {
    errors.eventType = "Select the Wedding Event Type.";
  }
  if (values.hostDisplayNames.some((name) => !name.trim())) {
    errors.hostDisplayNames = "Host Display Names cannot be blank.";
  }
  for (const key of ["eventTitle", "venueName", "venueAddress"] as const) {
    if (values[key] !== null && !values[key]?.trim()) {
      errors[key] =
        `${key === "eventTitle" ? "Event Title" : key === "venueName" ? "Venue Name" : "Venue Address"} cannot be blank.`;
    }
  }
  if (values.venueMapUrl) {
    try {
      const url = new URL(values.venueMapUrl);
      if (url.protocol !== "https:") throw new Error("Invalid protocol");
    } catch {
      errors.venueMapUrl = "Enter an absolute HTTPS Venue Map URL.";
    }
  }
  return errors;
}

export function eventDatabaseValues(values: EventValues) {
  return {
    event_type: values.eventType,
    event_title: values.eventTitle,
    host_display_names: values.hostDisplayNames,
    event_date: values.eventDate,
    start_time: values.startTime,
    end_time: values.endTime,
    event_timezone: values.eventTimezone,
    rsvp_deadline_local: values.rsvpDeadlineLocal,
    venue_name: values.venueName,
    venue_address: values.venueAddress,
    venue_map_url: values.venueMapUrl,
    dress_code: values.dressCode,
    invitation_message: values.invitationMessage,
    venue_arrival_notes: values.venueArrivalNotes,
    organizer_contact_information: values.organizerContactInformation,
  };
}
