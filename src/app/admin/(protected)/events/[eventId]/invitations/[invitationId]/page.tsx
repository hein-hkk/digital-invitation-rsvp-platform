import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyInvitationLink } from "@/components/admin/copy-invitation-link";
import {
  InvitationDetailForm,
  OrganizerRsvpForm,
} from "@/components/admin/invitation-detail-forms";
import { updateInvitationAction } from "@/modules/invitations/actions";
import { updateOrganizerRsvpAction } from "@/modules/rsvp/organizer-actions";
import {
  getInvitationAdminDetail,
  InvitationServiceError,
} from "@/modules/invitations/service";

export default async function InvitationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; invitationId: string }>;
  searchParams: Promise<{ invitationSaved?: string; rsvpSaved?: string }>;
}) {
  const { eventId, invitationId } = await params;
  const saved = await searchParams;
  let detail;
  try {
    detail = await getInvitationAdminDetail(eventId, invitationId);
  } catch (error) {
    if (
      error instanceof InvitationServiceError &&
      (error.code === "EVENT_NOT_FOUND" ||
        error.code === "INVITATION_NOT_FOUND")
    )
      notFound();
    throw error;
  }
  const {
    event,
    invitation,
    rsvp,
    runtimeState,
    accessState,
    currentInvitationUrl,
  } = detail;
  const canMutate = runtimeState !== "ended";
  const dateLabel = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: event.event_timezone ?? "UTC",
        }).format(new Date(value))
      : "—";
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/admin/events/${eventId}/invitations`}
        className="text-accent underline"
      >
        Back to Invitations
      </Link>
      <header className="mt-5">
        <p className="text-sm text-text-muted">
          {event.event_title || "Untitled Event"} ·{" "}
          <span className="capitalize">{runtimeState}</span>
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {invitation.invitee_name}
        </h1>
        <p className="mt-2 text-text-muted">
          RSVP:{" "}
          {rsvp.status === "awaiting_response"
            ? "Awaiting Response"
            : rsvp.status}{" "}
          · Access: {accessState}
        </p>
      </header>
      {(saved.invitationSaved === "1" || saved.rsvpSaved === "1") && (
        <p
          role="status"
          className="mt-5 rounded bg-success-soft p-4 text-success"
        >
          {saved.rsvpSaved === "1" ? "RSVP saved." : "Invitation saved."}
        </p>
      )}
      {runtimeState === "draft" && (
        <p className="mt-6 rounded bg-warning-soft p-4 text-warning">
          This event is still a draft. The invitation link won&apos;t open for
          guests until the event is published.
        </p>
      )}
      {runtimeState === "ended" && (
        <p className="mt-6 rounded bg-surface-subtle p-4 text-text-muted">
          Guest access has ended. This event is read-only.
        </p>
      )}
      <section className="mt-8 rounded border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">
          Guest Link / Access
        </h2>
        {currentInvitationUrl ? (
          <div className="mt-4">
            <CopyInvitationLink url={currentInvitationUrl} />
            <p className="mt-2 text-sm text-text-muted">
              Share this link privately with the invitee.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-text-muted">
            {accessState === "revoked"
              ? "This Invitation is revoked."
              : "Guest access has ended."}
          </p>
        )}
      </section>
      <section className="mt-6 rounded border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">
          Invitation Details
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-text-muted">Invitee Name</dt>
            <dd>{invitation.invitee_name}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Maximum Party Size</dt>
            <dd>{invitation.maximum_party_size}</dd>
          </div>
        </dl>
        {canMutate && (
          <InvitationDetailForm
            inviteeName={invitation.invitee_name}
            maximumPartySize={invitation.maximum_party_size}
            action={updateInvitationAction.bind(null, eventId, invitationId)}
          />
        )}
      </section>
      <section className="mt-6 rounded border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">Current RSVP</h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-text-muted">Status</dt>
            <dd className="capitalize">{rsvp.status.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Attendee Count</dt>
            <dd>{rsvp.attendee_count}</dd>
          </div>
          {rsvp.status === "attending" && rsvp.attendee_names.length > 0 && (
            <div>
              <dt className="text-sm text-text-muted">Attendee Names</dt>
              <dd className="whitespace-pre-wrap break-words">
                {rsvp.attendee_names.join("\n")}
              </dd>
            </div>
          )}
          {rsvp.status === "attending" && rsvp.dietary_requirements && (
            <div>
              <dt className="text-sm text-text-muted">Dietary Requirements</dt>
              <dd className="whitespace-pre-wrap break-words">
                {rsvp.dietary_requirements}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-text-muted">Guest Message</dt>
            <dd className="whitespace-pre-wrap break-words">
              {rsvp.guest_message || "—"}
            </dd>
          </div>
          {rsvp.status !== "awaiting_response" && (
            <>
              <div>
                <dt className="text-sm text-text-muted">Responded At</dt>
                <dd>{dateLabel(rsvp.responded_at)}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-muted">Updated At</dt>
                <dd>{dateLabel(rsvp.response_updated_at)}</dd>
              </div>
            </>
          )}
        </dl>
        {canMutate && (
          <OrganizerRsvpForm
            status={rsvp.status}
            attendeeCount={rsvp.attendee_count}
            attendeeNames={rsvp.attendee_names}
            dietaryRequirements={rsvp.dietary_requirements}
            guestMessage={rsvp.guest_message}
            maximumPartySize={invitation.maximum_party_size}
            action={updateOrganizerRsvpAction.bind(null, eventId, invitationId)}
          />
        )}
      </section>
    </main>
  );
}
