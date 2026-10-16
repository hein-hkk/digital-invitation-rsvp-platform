"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { GuestInvitationView } from "@/modules/guest-access/service";
import {
  initialGuestRsvpFormState,
  type GuestRsvpFormState,
} from "@/modules/rsvp/guest-form-state";

type Rsvp = GuestInvitationView["rsvp"];
type Choice = "" | "attending" | "declined";

function SubmitButton({ responded }: { responded: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 min-h-11 w-full rounded-md bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? "Saving…" : responded ? "Save Changes" : "Submit RSVP"}
    </button>
  );
}

function SavedSummary({ rsvp }: { rsvp: Rsvp }) {
  return (
    <div className="mt-5 space-y-3">
      <p className="font-medium">
        {rsvp.status === "attending" ? "Attending" : "Declined"}
      </p>
      {rsvp.status === "attending" && (
        <>
          <p className="text-text-muted">{rsvp.attendeeCount} attending</p>
          {rsvp.attendeeNames.length > 0 && (
            <ul className="list-inside list-disc text-text-muted">
              {rsvp.attendeeNames.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          )}
          {rsvp.dietaryRequirements && (
            <p className="whitespace-pre-wrap break-words text-text-muted">
              {rsvp.dietaryRequirements}
            </p>
          )}
        </>
      )}
      {rsvp.guestMessage && (
        <p className="whitespace-pre-wrap break-words text-text-muted">
          {rsvp.guestMessage}
        </p>
      )}
    </div>
  );
}

export function GuestRsvpSection({
  rsvp,
  maximumPartySize,
  canEdit,
  deadlineLabel,
  saved,
  action,
}: {
  rsvp: Rsvp;
  maximumPartySize: number;
  canEdit: boolean;
  deadlineLabel: string | null;
  saved: boolean;
  action: (
    previous: GuestRsvpFormState,
    form: FormData,
  ) => Promise<GuestRsvpFormState>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialGuestRsvpFormState);
  const [editing, setEditing] = useState(rsvp.status === "awaiting_response");
  const [choice, setChoice] = useState<Choice>(
    rsvp.status === "awaiting_response" ? "" : rsvp.status,
  );
  const [count, setCount] = useState(
    rsvp.attendeeCount ? String(rsvp.attendeeCount) : "",
  );
  const [names, setNames] = useState(rsvp.attendeeNames);
  const [dietary, setDietary] = useState(rsvp.dietaryRequirements ?? "");
  const [message, setMessage] = useState(rsvp.guestMessage ?? "");
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (state.kind === "conflict") router.refresh();
  }, [state, router]);

  const responded = rsvp.status !== "awaiting_response";
  const selectedCount = Number(count);
  const tooManyNames =
    choice === "attending" &&
    names.filter((name) => name.trim()).length > selectedCount;
  const statusError = choice ? null : state.fieldErrors.status;
  const formMessage = state.fieldErrors.status ? null : state.message;

  return (
    <section
      id="rsvp"
      aria-labelledby="rsvp-heading"
      className="mt-14 rounded-xl border border-border bg-surface px-5 py-7 shadow-sm sm:px-9"
    >
      <h2 id="rsvp-heading" className="font-display text-2xl">
        RSVP
      </h2>
      {!canEdit && (
        <p
          role="status"
          className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-text"
        >
          RSVP changes are now closed.
        </p>
      )}
      {saved && responded && (
        <p role="status" className="mt-4 text-sm font-semibold text-success">
          Your RSVP has been saved.
        </p>
      )}
      {formMessage && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {formMessage}
        </p>
      )}

      {!canEdit ? (
        responded ? (
          <SavedSummary rsvp={rsvp} />
        ) : (
          <p className="mt-5 font-medium">Awaiting Response</p>
        )
      ) : responded && !editing ? (
        <>
          <SavedSummary rsvp={rsvp} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-6 min-h-11 rounded-md border border-accent px-5 py-2 font-semibold text-accent hover:bg-accent-soft"
          >
            Update RSVP
          </button>
        </>
      ) : (
        <form
          action={formAction}
          className="mt-6 space-y-6"
          onSubmit={(event) => {
            if (tooManyNames) {
              event.preventDefault();
              setNameError(true);
            }
          }}
        >
          <fieldset>
            <legend className="font-medium">Will you be attending?</legend>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["attending", "declined"] as const).map((option) => (
                <label
                  key={option}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 ${choice === option ? "border-accent bg-accent-soft" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option}
                    checked={choice === option}
                    onChange={() => setChoice(option)}
                    className="accent-accent"
                    aria-describedby={statusError ? "status-error" : undefined}
                  />
                  <span className="font-medium">
                    {option === "attending" ? "Attending" : "Declined"}
                  </span>
                </label>
              ))}
            </div>
            {statusError && (
              <p id="status-error" className="mt-2 text-sm text-danger">
                {statusError}
              </p>
            )}
          </fieldset>

          {choice === "attending" && (
            <>
              <div>
                <label htmlFor="attendee-count" className="block font-medium">
                  How many people will attend?
                </label>
                <p
                  id="party-size-help"
                  className="mt-1 text-sm text-text-muted"
                >
                  This invitation is for up to {maximumPartySize} people.
                </p>
                <select
                  id="attendee-count"
                  name="attendeeCount"
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  aria-describedby={
                    state.fieldErrors.attendeeCount
                      ? "party-size-help count-error"
                      : "party-size-help"
                  }
                  aria-invalid={Boolean(state.fieldErrors.attendeeCount)}
                  className="mt-3 min-h-11 w-full rounded-md border border-border bg-surface px-3"
                >
                  <option value="">Select number of attendees</option>
                  {Array.from({ length: maximumPartySize }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
                {state.fieldErrors.attendeeCount && (
                  <p id="count-error" className="mt-2 text-sm text-danger">
                    {state.fieldErrors.attendeeCount}
                  </p>
                )}
              </div>

              <fieldset>
                <legend className="font-medium">
                  Attendee names{" "}
                  <span className="text-sm font-normal text-text-muted">
                    (optional)
                  </span>
                </legend>
                <p className="mt-1 text-sm text-text-muted">
                  You can add names for some or all attendees.
                </p>
                <div className="mt-3 space-y-3">
                  {names.map((name, index) => (
                    <div key={index} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={`attendee-name-${index}`}
                          className="block text-sm"
                        >
                          Attendee name {index + 1}
                        </label>
                        <input
                          id={`attendee-name-${index}`}
                          name="attendeeNames"
                          value={name}
                          onChange={(event) => {
                            setNames((current) =>
                              current.map((item, at) =>
                                at === index ? event.target.value : item,
                              ),
                            );
                            setNameError(false);
                          }}
                          className="mt-1 min-h-11 w-full rounded-md border border-border px-3"
                          aria-invalid={nameError || tooManyNames}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNames((current) =>
                            current.filter((_, at) => at !== index),
                          );
                          setNameError(false);
                        }}
                        aria-label={`Remove attendee name ${index + 1}`}
                        className="min-h-11 rounded-md border border-border px-3 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                {(nameError ||
                  tooManyNames ||
                  state.fieldErrors.attendeeNames) && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    You have more attendee names than the selected attendee
                    count.
                  </p>
                )}
                {names.length < selectedCount && names.length < 20 && (
                  <button
                    type="button"
                    onClick={() => setNames((current) => [...current, ""])}
                    className="mt-3 min-h-11 rounded-md border border-accent px-4 py-2 font-medium text-accent"
                  >
                    Add attendee name
                  </button>
                )}
              </fieldset>

              <div>
                <label
                  htmlFor="dietary-requirements"
                  className="block font-medium"
                >
                  Dietary requirements{" "}
                  <span className="text-sm font-normal text-text-muted">
                    (optional)
                  </span>
                </label>
                <p className="mt-1 text-sm text-text-muted">
                  For the RSVP as a whole.
                </p>
                <textarea
                  id="dietary-requirements"
                  name="dietaryRequirements"
                  value={dietary}
                  onChange={(event) => setDietary(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-border px-3 py-2"
                />
              </div>
            </>
          )}

          {choice === "declined" &&
            responded &&
            rsvp.status === "attending" && (
              <p className="rounded-md bg-warning-soft px-4 py-3 text-sm text-text">
                Changing to Declined will remove the attendee count, attendee
                names, and dietary requirements from your RSVP.
              </p>
            )}

          {(choice === "attending" || choice === "declined") && (
            <div>
              <label htmlFor="guest-message" className="block font-medium">
                Message for the hosts{" "}
                <span className="text-sm font-normal text-text-muted">
                  (optional)
                </span>
              </label>
              <textarea
                id="guest-message"
                name="guestMessage"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-md border border-border px-3 py-2"
              />
            </div>
          )}
          <SubmitButton responded={responded} />
          {responded && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-11 w-full rounded-md px-4 py-2 text-sm font-medium text-text-muted underline"
            >
              Cancel
            </button>
          )}
        </form>
      )}

      {canEdit && deadlineLabel && (
        <p className="mt-5 text-sm text-text-muted">
          Please RSVP by {deadlineLabel}.
        </p>
      )}
    </section>
  );
}
