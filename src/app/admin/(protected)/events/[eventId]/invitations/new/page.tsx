import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationForm } from "@/components/admin/invitation-form";
import { createInvitationAction } from "@/modules/invitations/actions";
import {
  InvitationServiceError,
  listEventInvitations,
} from "@/modules/invitations/service";

export default async function NewInvitationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  let workspace;
  try {
    workspace = await listEventInvitations(eventId);
  } catch (error) {
    if (
      error instanceof InvitationServiceError &&
      error.code === "EVENT_NOT_FOUND"
    )
      notFound();
    throw error;
  }
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href={`/admin/events/${eventId}/invitations`}
        className="text-accent underline"
      >
        Back to Invitations
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold">
        Create Invitation
      </h1>
      <p className="mt-2 text-text-muted">
        {workspace.event.event_title || "Untitled Event"}
      </p>
      {workspace.runtimeState === "draft" && (
        <p className="mt-6 rounded bg-warning-soft p-4 text-warning">
          This event is still a draft. The invitation link won&apos;t open for
          guests until the event is published.
        </p>
      )}
      {workspace.canMutate ? (
        <InvitationForm action={createInvitationAction.bind(null, eventId)} />
      ) : (
        <p className="mt-6 rounded bg-surface-subtle p-4 text-text-muted">
          This Event has ended and is read-only.
        </p>
      )}
    </main>
  );
}
