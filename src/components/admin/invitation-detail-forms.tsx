"use client";

import { useActionState, useState } from "react";
import type { InvitationFormState } from "@/modules/invitations/actions";
import type { OrganizerRsvpFormState } from "@/modules/rsvp/organizer-actions";

type InvitationAction = (
  state: InvitationFormState,
  form: FormData,
) => Promise<InvitationFormState>;

type RsvpAction = (
  state: OrganizerRsvpFormState,
  form: FormData,
) => Promise<OrganizerRsvpFormState>;

export function InvitationDetailForm({
  inviteeName,
  maximumPartySize,
  action,
}: {
  inviteeName: string;
  maximumPartySize: number;
  action: InvitationAction;
}) {
  const [state, formAction, pending] = useActionState(action, {
    values: { inviteeName, maximumPartySize: String(maximumPartySize) },
    fieldErrors: {},
    message: null,
  });
  return (
    <form action={formAction} className="mt-5 space-y-5">
      {state.message && (
        <p role="alert" className="rounded bg-danger-soft p-3 text-danger">
          {state.message}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-invitee-name" className="font-medium">
            Invitee Name
          </label>
          <input
            id="edit-invitee-name"
            name="inviteeName"
            required
            defaultValue={state.values.inviteeName}
            aria-invalid={Boolean(state.fieldErrors.inviteeName)}
            aria-describedby={
              state.fieldErrors.inviteeName
                ? "edit-invitee-name-error"
                : undefined
            }
            className="min-h-11 rounded border border-border-strong px-3 py-2"
          />
          {state.fieldErrors.inviteeName && (
            <p id="edit-invitee-name-error" className="text-sm text-danger">
              {state.fieldErrors.inviteeName}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-maximum-party-size" className="font-medium">
            Maximum Party Size
          </label>
          <input
            id="edit-maximum-party-size"
            name="maximumPartySize"
            type="number"
            min="1"
            max="20"
            step="1"
            required
            defaultValue={state.values.maximumPartySize}
            aria-invalid={Boolean(state.fieldErrors.maximumPartySize)}
            aria-describedby={
              state.fieldErrors.maximumPartySize
                ? "edit-maximum-party-size-error"
                : undefined
            }
            className="min-h-11 rounded border border-border-strong px-3 py-2"
          />
          {state.fieldErrors.maximumPartySize && (
            <p
              id="edit-maximum-party-size-error"
              className="text-sm text-danger"
            >
              {state.fieldErrors.maximumPartySize}
            </p>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Invitation"}
      </button>
    </form>
  );
}

export function OrganizerRsvpForm({
  status,
  attendeeCount,
  attendeeNames,
  dietaryRequirements,
  guestMessage,
  maximumPartySize,
  action,
}: {
  status: "awaiting_response" | "attending" | "declined";
  attendeeCount: number;
  attendeeNames: string[];
  dietaryRequirements: string | null;
  guestMessage: string | null;
  maximumPartySize: number;
  action: RsvpAction;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<
    "attending" | "declined" | ""
  >(status === "awaiting_response" ? "" : status);
  const [state, formAction, pending] = useActionState(action, {
    values: {
      status: status === "awaiting_response" ? "" : status,
      attendeeCount: attendeeCount ? String(attendeeCount) : "",
      attendeeNames: attendeeNames.join("\n"),
      dietaryRequirements: dietaryRequirements ?? "",
    },
    fieldErrors: {},
    message: null,
  });
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-5 min-h-11 rounded border border-accent px-5 py-2 font-medium text-accent"
      >
        Edit RSVP
      </button>
    );
  }
  return (
    <form
      action={formAction}
      className="mt-6 space-y-5 border-t border-border pt-6"
    >
      <h3 className="font-display text-xl">Edit RSVP</h3>
      {state.message && (
        <p role="alert" className="rounded bg-danger-soft p-3 text-danger">
          {state.message}
        </p>
      )}
      <fieldset>
        <legend className="font-medium">RSVP Status</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["attending", "declined"] as const).map((choice) => (
            <label key={choice} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="status"
                value={choice}
                checked={selectedStatus === choice}
                onChange={() => setSelectedStatus(choice)}
              />
              {choice === "attending" ? "Attending" : "Declined"}
            </label>
          ))}
        </div>
        {state.fieldErrors.status && (
          <p className="text-sm text-danger">{state.fieldErrors.status}</p>
        )}
      </fieldset>
      {selectedStatus === "attending" && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="admin-attendee-count" className="font-medium">
              Attendee Count
            </label>
            <input
              id="admin-attendee-count"
              name="attendeeCount"
              type="number"
              min="1"
              max={maximumPartySize}
              step="1"
              required
              defaultValue={state.values.attendeeCount}
              aria-invalid={Boolean(state.fieldErrors.attendeeCount)}
              aria-describedby={
                state.fieldErrors.attendeeCount
                  ? "admin-attendee-count-error"
                  : "admin-attendee-count-help"
              }
              className="min-h-11 w-32 rounded border border-border-strong px-3 py-2"
            />
            <p
              id="admin-attendee-count-help"
              className="text-sm text-text-muted"
            >
              Maximum Party Size: {maximumPartySize}
            </p>
            {state.fieldErrors.attendeeCount && (
              <p
                id="admin-attendee-count-error"
                className="text-sm text-danger"
              >
                {state.fieldErrors.attendeeCount}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="admin-attendee-names" className="font-medium">
              Attendee Names (optional)
            </label>
            <p className="text-sm text-text-muted">
              One name per line. You may leave names blank.
            </p>
            <textarea
              id="admin-attendee-names"
              name="attendeeNames"
              rows={4}
              defaultValue={state.values.attendeeNames}
              aria-invalid={Boolean(state.fieldErrors.attendeeNames)}
              aria-describedby={
                state.fieldErrors.attendeeNames
                  ? "admin-attendee-names-error"
                  : undefined
              }
              className="rounded border border-border-strong px-3 py-2"
            />
            {state.fieldErrors.attendeeNames && (
              <p
                id="admin-attendee-names-error"
                className="text-sm text-danger"
              >
                {state.fieldErrors.attendeeNames}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="admin-dietary" className="font-medium">
              Dietary Requirements (optional)
            </label>
            <textarea
              id="admin-dietary"
              name="dietaryRequirements"
              rows={3}
              defaultValue={state.values.dietaryRequirements}
              className="rounded border border-border-strong px-3 py-2"
            />
          </div>
        </>
      )}
      {selectedStatus === "declined" &&
        (attendeeCount > 0 ||
          attendeeNames.length > 0 ||
          dietaryRequirements) && (
          <p className="rounded bg-warning-soft p-3 text-sm">
            Saving Declined clears Attendee Count, Attendee Names, and Dietary
            Requirements. Guest Message is preserved.
          </p>
        )}
      <div>
        <p className="font-medium">Guest Message (read-only)</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-text-muted">
          {guestMessage || "—"}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save RSVP"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-11 rounded border border-border px-5 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
