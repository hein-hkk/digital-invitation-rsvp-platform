"use client";

import { useActionState, useRef } from "react";
import type { InvitationAccessActionState } from "@/modules/invitations/actions";

type AccessAction = (
  state: InvitationAccessActionState,
  form: FormData,
) => Promise<InvitationAccessActionState>;

function ConfirmAccessAction({
  action,
  buttonLabel,
  title,
  description,
  danger = false,
}: {
  action: AccessAction;
  buttonLabel: string;
  title: string;
  description: string;
  danger?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(action, {
    message: null,
  });
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`min-h-11 rounded border px-4 py-2 font-medium ${danger ? "border-danger text-danger" : "border-accent text-accent"}`}
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClose={() => trigger.current?.focus()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded border border-border bg-surface p-6 text-text shadow-xl backdrop:bg-black/50"
      >
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="mt-3 text-text-muted">{description}</p>
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
            className={`min-h-11 rounded px-4 py-2 font-medium text-white disabled:opacity-60 ${danger ? "bg-danger" : "bg-accent"}`}
          >
            {pending ? "Working…" : buttonLabel}
          </button>
        </form>
      </dialog>
    </>
  );
}

export function InvitationAccessActions({
  regenerateAction,
  revokeAction,
}: {
  regenerateAction: AccessAction;
  revokeAction: AccessAction;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <ConfirmAccessAction
        action={regenerateAction}
        buttonLabel="Regenerate Link"
        title="Regenerate invitation link?"
        description="The current link will stop working immediately. The RSVP and invitation data will be preserved."
      />
      <ConfirmAccessAction
        action={revokeAction}
        buttonLabel="Revoke Invitation"
        title="Revoke this invitation?"
        description="The guest will no longer be able to open this invitation link. The invitation and current RSVP will be preserved. No replacement link will be created."
        danger
      />
    </div>
  );
}
