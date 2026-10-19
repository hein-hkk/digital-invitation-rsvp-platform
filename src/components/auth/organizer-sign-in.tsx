"use client";

import { useActionState } from "react";
import {
  requestOrganizerOtp,
  verifyOrganizerOtp,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/modules/auth/actions";

const requestInitial: RequestOtpState = { status: "idle", email: "" };
const verifyInitial: VerifyOtpState = { status: "idle" };

export function OrganizerSignIn() {
  const [request, requestAction, requestPending] = useActionState(
    requestOrganizerOtp,
    requestInitial,
  );
  const [verification, verifyAction, verifyPending] = useActionState(
    verifyOrganizerOtp,
    verifyInitial,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Organizer sign in</h1>
      <p className="mt-3 text-text-muted">
        Enter your provisioned email address to receive a one-time sign-in code.
      </p>
      <form action={requestAction} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={request.email}
          className="rounded border border-border-strong bg-surface px-3 py-2"
        />
        <button
          disabled={requestPending}
          className="rounded bg-accent px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {requestPending ? "Sending…" : "Send code"}
        </button>
      </form>
      {request.status === "error" && (
        <p role="alert" className="mt-3 text-danger">
          Enter a valid email address.
        </p>
      )}
      {request.status === "throttled" && (
        <p role="alert" className="mt-3 text-danger">
          Too many code requests. Try again later.
        </p>
      )}
      {request.status === "unavailable" && (
        <p role="alert" className="mt-3 text-danger">
          Sign in is temporarily unavailable. Try again later.
        </p>
      )}
      {request.status === "sent" && (
        <section className="mt-8 border-t border-border pt-6">
          <p role="status" className="text-text-muted">
            If this address is provisioned, a code will arrive. Check your inbox
            or contact support.
          </p>
          <form action={verifyAction} className="mt-5 flex flex-col gap-3">
            <input type="hidden" name="email" value={request.email} />
            <label htmlFor="token" className="font-medium">
              Six-digit code
            </label>
            <input
              id="token"
              name="token"
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              maxLength={6}
              className="rounded border border-border-strong bg-surface px-3 py-2"
            />
            <button
              disabled={verifyPending}
              className="rounded bg-accent px-4 py-2 font-medium text-white disabled:opacity-60"
            >
              {verifyPending ? "Verifying…" : "Verify code"}
            </button>
          </form>
          {verification.status === "error" && (
            <p role="alert" className="mt-3 text-danger">
              The code is invalid or expired. Request a new code and try again.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
