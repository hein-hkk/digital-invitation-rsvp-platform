"use client";

import { useActionState, useEffect, useState } from "react";
import type { EventFormState } from "@/modules/events/actions";
import type { EventValues } from "@/modules/events/schema";

type Action = (
  state: EventFormState,
  form: FormData,
) => Promise<EventFormState>;

function Field({
  name,
  label,
  value,
  error,
  type = "text",
  hint,
}: {
  name: keyof EventValues;
  label: string;
  value: string | null;
  error?: string;
  type?: string;
  hint?: string;
}) {
  const displayed =
    type === "datetime-local" && value ? value.slice(0, 16) : (value ?? "");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={displayed}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
        className="rounded border border-border-strong bg-surface px-3 py-2"
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function TextArea({
  name,
  label,
  value,
  error,
  hint,
}: {
  name: keyof EventValues;
  label: string;
  value: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="font-medium">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        defaultValue={value}
        rows={3}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
        className="rounded border border-border-strong bg-surface px-3 py-2"
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function EventForm({
  initialValues,
  action,
  mode,
  publicationErrors = {},
}: {
  initialValues: EventValues;
  action: Action;
  mode: "create" | "draft" | "published";
  publicationErrors?: Record<string, string>;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [state, formAction, pending] = useActionState(action, {
    status: "idle" as const,
    values: initialValues,
    fieldErrors: {},
    message: null,
  });
  const values = state.values;
  const errors = {
    ...(state.status === "saved" ? {} : publicationErrors),
    ...state.fieldErrors,
  };
  const field = (name: keyof EventValues) => errors[name];

  return (
    <form action={formAction} className="space-y-8">
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "rounded bg-danger-soft p-3 text-danger"
              : "rounded bg-success-soft p-3 text-success"
          }
        >
          {state.message}
        </p>
      )}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Basics</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="eventType" className="font-medium">
            Event Type
          </label>
          <select
            id="eventType"
            name="eventType"
            defaultValue={values.eventType ?? ""}
            aria-invalid={Boolean(field("eventType"))}
            className="rounded border border-border-strong bg-surface px-3 py-2"
          >
            <option value="">Select Event Type</option>
            <option value="wedding">Wedding</option>
          </select>
          {field("eventType") && (
            <p className="text-sm text-danger">{field("eventType")}</p>
          )}
        </div>
        <Field
          name="eventTitle"
          label="Event Title"
          value={values.eventTitle}
          error={field("eventTitle")}
        />
        <TextArea
          name="hostDisplayNames"
          label="Wedding / Host Display Names"
          value={values.hostDisplayNames.join("\n")}
          error={field("hostDisplayNames")}
          hint="Enter one display name per line."
        />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Date &amp; Time</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="eventDate"
            label="Event Date"
            type="date"
            value={values.eventDate}
            error={field("eventDate")}
          />
          <Field
            name="eventTimezone"
            label="Event Timezone"
            value={values.eventTimezone}
            error={field("eventTimezone")}
            hint="Use an IANA timezone, such as Asia/Bangkok."
          />
          <Field
            name="startTime"
            label="Start Time"
            type="time"
            value={values.startTime}
            error={field("startTime")}
          />
          <Field
            name="endTime"
            label="End Time (optional)"
            type="time"
            value={values.endTime}
            error={field("endTime")}
          />
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">Venue</h2>
        <Field
          name="venueName"
          label="Venue Name"
          value={values.venueName}
          error={field("venueName")}
        />
        <TextArea
          name="venueAddress"
          label="Venue Address"
          value={values.venueAddress ?? ""}
          error={field("venueAddress")}
        />
        <Field
          name="venueMapUrl"
          label="Venue Map URL (optional)"
          type="url"
          value={values.venueMapUrl}
          error={field("venueMapUrl")}
        />
        <TextArea
          name="venueArrivalNotes"
          label="Venue / Arrival Notes (optional)"
          value={values.venueArrivalNotes ?? ""}
          error={field("venueArrivalNotes")}
        />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          Invitation Content
        </h2>
        <TextArea
          name="invitationMessage"
          label="Event Description / Invitation Message (optional)"
          value={values.invitationMessage ?? ""}
          error={field("invitationMessage")}
        />
        <Field
          name="dressCode"
          label="Dress Code (optional)"
          value={values.dressCode}
          error={field("dressCode")}
        />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">RSVP Settings</h2>
        <Field
          name="rsvpDeadlineLocal"
          label="RSVP Deadline (optional)"
          type="datetime-local"
          value={values.rsvpDeadlineLocal}
          error={field("rsvpDeadlineLocal")}
          hint="Guest changes close at the deadline. Without one, they remain open until the Event ends."
        />
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          Organizer Contact
        </h2>
        <TextArea
          name="organizerContactInformation"
          label="Organizer Contact Information (optional)"
          value={values.organizerContactInformation ?? ""}
          error={field("organizerContactInformation")}
        />
      </section>
      <button
        disabled={!ready || pending}
        className="rounded bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : mode === "published"
            ? "Save Changes"
            : "Save Draft"}
      </button>
    </form>
  );
}
