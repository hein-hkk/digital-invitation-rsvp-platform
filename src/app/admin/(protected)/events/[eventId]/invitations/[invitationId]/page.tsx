import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyInvitationLink } from "@/components/admin/copy-invitation-link";
import {
  getInvitationAdminDetail,
  InvitationServiceError,
} from "@/modules/invitations/service";

export default async function InvitationDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; invitationId: string }>;
}) {
  const { eventId, invitationId } = await params;
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
              Share this link privately with the invitee. Guest viewing will be
              available when the Guest experience is released.
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
      </section>
      <section className="mt-6 rounded border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">Current RSVP</h2>
        <p className="mt-3 capitalize">{rsvp.status.replaceAll("_", " ")}</p>
        <p className="mt-1 text-text-muted">
          Attendee Count: {rsvp.attendee_count}
        </p>
      </section>
    </main>
  );
}
