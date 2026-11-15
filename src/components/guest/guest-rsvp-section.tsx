"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { SavedMark } from "@/components/wedding/ornaments";
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
      className="wedding-button wedding-button--block"
    >
      {pending ? "Saving…" : responded ? "Save Changes" : "Submit RSVP"}
    </button>
  );
}

function SavedSummary({ rsvp }: { rsvp: Rsvp }) {
  return (
    <div className="wedding-rsvp__summary">
      <SavedMark />
      <p className="wedding-rsvp__status">
        {rsvp.status === "attending" ? "Attending" : "Declined"}
      </p>
      {rsvp.status === "attending" && (
        <>
          <p className="wedding-rsvp__count">{rsvp.attendeeCount} attending</p>
          {rsvp.attendeeNames.length > 0 && (
            <ul className="wedding-rsvp__names">
              {rsvp.attendeeNames.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          )}
          {rsvp.dietaryRequirements && (
            <p className="wedding-rsvp__note">{rsvp.dietaryRequirements}</p>
          )}
        </>
      )}
      {rsvp.guestMessage && (
        <p className="wedding-rsvp__note wedding-rsvp__note--message">
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
    <section id="rsvp" aria-labelledby="rsvp-heading" className="wedding-rsvp">
      <div className="wedding-rsvp__header">
        <p className="wedding-eyebrow">Kindly respond</p>
        <h2 id="rsvp-heading" className="wedding-title">
          RSVP
        </h2>
        {canEdit && deadlineLabel && (
          <p className="wedding-rsvp__deadline">
            Please RSVP by {deadlineLabel}.
          </p>
        )}
      </div>
      {!canEdit && (
        <p role="status" className="wedding-alert wedding-alert--warning">
          RSVP changes are now closed.
        </p>
      )}
      {saved && responded && (
        <p role="status" className="wedding-alert wedding-alert--success">
          Your RSVP has been saved.
        </p>
      )}
      {formMessage && (
        <p role="alert" className="wedding-alert wedding-alert--danger">
          {formMessage}
        </p>
      )}

      {!canEdit ? (
        responded ? (
          <SavedSummary rsvp={rsvp} />
        ) : (
          <p className="wedding-rsvp__status wedding-rsvp__status--quiet">
            Awaiting Response
          </p>
        )
      ) : responded && !editing ? (
        <>
          <SavedSummary rsvp={rsvp} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="wedding-button wedding-button--quiet wedding-rsvp__update"
          >
            Update RSVP
          </button>
        </>
      ) : (
        <form
          action={formAction}
          className="wedding-form"
          onSubmit={(event) => {
            if (tooManyNames) {
              event.preventDefault();
              setNameError(true);
            }
          }}
        >
          <fieldset>
            <legend className="wedding-form__question">
              Will you be attending?
            </legend>
            <div className="wedding-choices">
              {(["attending", "declined"] as const).map((option) => (
                <label
                  key={option}
                  className="wedding-choice"
                  data-selected={choice === option ? "true" : undefined}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option}
                    checked={choice === option}
                    onChange={() => setChoice(option)}
                    className="wedding-choice__input"
                    aria-describedby={statusError ? "status-error" : undefined}
                  />
                  <span className="wedding-choice__label">
                    {option === "attending" ? "Attending" : "Declined"}
                  </span>
                </label>
              ))}
            </div>
            {statusError && (
              <p id="status-error" className="wedding-form__error">
                {statusError}
              </p>
            )}
          </fieldset>

          {choice === "attending" && (
            <div className="wedding-form__group wedding-form__reveal">
              <div>
                <label htmlFor="attendee-count" className="wedding-form__label">
                  How many people will attend?
                </label>
                <p id="party-size-help" className="wedding-form__help">
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
                  className="wedding-input wedding-input--select"
                >
                  <option value="">Select number of attendees</option>
                  {Array.from({ length: maximumPartySize }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
                {state.fieldErrors.attendeeCount && (
                  <p id="count-error" className="wedding-form__error">
                    {state.fieldErrors.attendeeCount}
                  </p>
                )}
              </div>

              <fieldset>
                <legend className="wedding-form__label">
                  Attendee names{" "}
                  <span className="wedding-form__optional">(optional)</span>
                </legend>
                <p className="wedding-form__help">
                  You can add names for some or all attendees.
                </p>
                <div className="wedding-form__names">
                  {names.map((name, index) => (
                    <div key={index} className="wedding-form__name-row">
                      <div className="wedding-form__name-field">
                        <label
                          htmlFor={`attendee-name-${index}`}
                          className="wedding-form__help"
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
                          className="wedding-input"
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
                        className="wedding-form__remove"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                {(nameError ||
                  tooManyNames ||
                  state.fieldErrors.attendeeNames) && (
                  <p role="alert" className="wedding-form__error">
                    You have more attendee names than the selected attendee
                    count.
                  </p>
                )}
                {names.length < selectedCount && names.length < 20 && (
                  <button
                    type="button"
                    onClick={() => setNames((current) => [...current, ""])}
                    className="wedding-form__add"
                  >
                    Add attendee name
                  </button>
                )}
              </fieldset>

              <div>
                <label
                  htmlFor="dietary-requirements"
                  className="wedding-form__label"
                >
                  Dietary requirements{" "}
                  <span className="wedding-form__optional">(optional)</span>
                </label>
                <p className="wedding-form__help">For the RSVP as a whole.</p>
                <textarea
                  id="dietary-requirements"
                  name="dietaryRequirements"
                  value={dietary}
                  onChange={(event) => setDietary(event.target.value)}
                  rows={3}
                  className="wedding-input wedding-input--area"
                />
              </div>
            </div>
          )}

          {choice === "declined" &&
            responded &&
            rsvp.status === "attending" && (
              <p className="wedding-alert wedding-alert--warning">
                Changing to Declined will remove the attendee count, attendee
                names, and dietary requirements from your RSVP.
              </p>
            )}

          {(choice === "attending" || choice === "declined") && (
            <div className="wedding-form__reveal">
              <label htmlFor="guest-message" className="wedding-form__label">
                Message for the hosts{" "}
                <span className="wedding-form__optional">(optional)</span>
              </label>
              <textarea
                id="guest-message"
                name="guestMessage"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                className="wedding-input wedding-input--area"
              />
            </div>
          )}
          <SubmitButton responded={responded} />
          {responded && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="wedding-form__cancel"
            >
              Cancel
            </button>
          )}
        </form>
      )}
    </section>
  );
}
