"use client";

import { useActionState, useRef } from "react";
import type { EventDeleteState } from "@/modules/events/actions";

export function EventDeleteAction({
  eventTitle,
  action,
}: {
  eventTitle: string;
  action: (
    state: EventDeleteState,
    form: FormData,
  ) => Promise<EventDeleteState>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(action, {
    message: null,
  });

  return (
    <section
      aria-labelledby="delete-event-heading"
      className="mt-10 border-t border-border pt-8"
    >
      <h2
        id="delete-event-heading"
        className="font-display text-2xl font-semibold"
      >
        Delete Event
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Permanently remove this Event and its invitations.
      </p>
      <button
        ref={trigger}
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mt-5 min-h-11 rounded border border-danger px-5 py-2 font-medium text-danger"
      >
        Delete Event
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="delete-event-dialog-title"
        onClose={() => trigger.current?.focus()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded border border-border bg-surface p-6 text-text shadow-xl backdrop:bg-black/50"
      >
        <h3
          id="delete-event-dialog-title"
          className="font-display text-xl font-semibold"
        >
          Permanently delete this event?
        </h3>
        <p className="mt-3 break-words">{eventTitle}</p>
        <p className="mt-4 text-text-muted">
          This permanently removes the Event, Invitations, current RSVPs,
          Invitation access credentials, and Hero Image. This cannot be undone.
        </p>
        {state.message && (
          <p
            role="alert"
            className="mt-4 rounded bg-danger-soft p-3 text-danger"
          >
            {state.message}
          </p>
        )}
        <form
          action={formAction}
          className="mt-6 flex flex-wrap justify-end gap-3"
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
            className="min-h-11 rounded border border-border-strong px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded bg-danger px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Permanently Delete Event"}
          </button>
        </form>
      </dialog>
    </section>
  );
}
