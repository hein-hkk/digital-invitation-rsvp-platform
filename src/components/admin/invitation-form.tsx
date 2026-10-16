"use client";

import { useActionState, useEffect, useState } from "react";
import type { InvitationFormState } from "@/modules/invitations/actions";
import { emptyInvitationValues } from "@/modules/invitations/schema";

type Action = (
  state: InvitationFormState,
  form: FormData,
) => Promise<InvitationFormState>;

export function InvitationForm({ action }: { action: Action }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [state, formAction, pending] = useActionState(action, {
    values: emptyInvitationValues,
    fieldErrors: {},
    message: null,
  });
  return (
    <form
      action={formAction}
      className="mt-8 space-y-6 rounded border border-border bg-surface p-6"
    >
      {state.message && (
        <p role="alert" className="rounded bg-danger-soft p-3 text-danger">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="inviteeName" className="font-medium">
          Invitee Name
        </label>
        <input
          id="inviteeName"
          name="inviteeName"
          type="text"
          required
          defaultValue={state.values.inviteeName}
          aria-invalid={Boolean(state.fieldErrors.inviteeName)}
          aria-describedby={
            state.fieldErrors.inviteeName ? "inviteeName-error" : undefined
          }
          className="rounded border border-border-strong px-3 py-3"
        />
        {state.fieldErrors.inviteeName && (
          <p id="inviteeName-error" className="text-sm text-danger">
            {state.fieldErrors.inviteeName}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="maximumPartySize" className="font-medium">
          Maximum Party Size
        </label>
        <input
          id="maximumPartySize"
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
              ? "maximumPartySize-error"
              : "maximumPartySize-hint"
          }
          className="w-full rounded border border-border-strong px-3 py-3 sm:max-w-48"
        />
        <p id="maximumPartySize-hint" className="text-sm text-text-muted">
          Maximum number of people who can attend through this invitation.
        </p>
        {state.fieldErrors.maximumPartySize && (
          <p id="maximumPartySize-error" className="text-sm text-danger">
            {state.fieldErrors.maximumPartySize}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={!ready || pending}
        className="min-h-11 rounded bg-accent px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create Invitation"}
      </button>
    </form>
  );
}
