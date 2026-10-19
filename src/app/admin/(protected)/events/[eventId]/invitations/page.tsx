import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportCsvButton } from "@/components/admin/export-csv-button";
import {
  InvitationServiceError,
  listEventInvitations,
} from "@/modules/invitations/service";

function rsvpLabel(status: string | undefined) {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Declined";
  return "Awaiting Response";
}

function updatedLabel(
  value: string | null | undefined,
  timezone: string | null,
) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone ?? "UTC",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export default async function InvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const status =
    query.status === "awaiting_response" ||
    query.status === "attending" ||
    query.status === "declined"
      ? query.status
      : undefined;
  const hasFilters = Boolean(search || status);
  let workspace;
  try {
    workspace = await listEventInvitations(eventId, {
      search,
      rsvpStatus: status,
    });
  } catch (error) {
    if (
      error instanceof InvitationServiceError &&
      error.code === "EVENT_NOT_FOUND"
    )
      notFound();
    throw error;
  }
  const { event, runtimeState, canMutate, invitations, totalInvitationCount } =
    workspace;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/admin/events/${eventId}`} className="text-accent underline">
        Back to Event
      </Link>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">
            {event.event_title || "Untitled Event"} ·{" "}
            <span className="capitalize">{runtimeState}</span>
          </p>
          <h1 className="font-display text-3xl font-semibold">Invitations</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canMutate && (
            <Link
              href={`/admin/events/${eventId}/invitations/new`}
              className="min-h-11 rounded bg-accent px-4 py-3 font-medium text-white"
            >
              Create Invitation
            </Link>
          )}
          <ExportCsvButton eventId={eventId} />
        </div>
      </div>
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
      <form
        action={`/admin/events/${eventId}/invitations`}
        method="get"
        className="mt-8 flex flex-col gap-4 rounded border border-border bg-surface p-5 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="invitation-search" className="font-medium">
            Search by invitee name
          </label>
          <input
            id="invitation-search"
            name="search"
            type="search"
            defaultValue={search}
            className="min-h-11 rounded border border-border-strong px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="rsvp-status-filter" className="font-medium">
            RSVP Status
          </label>
          <select
            id="rsvp-status-filter"
            name="status"
            defaultValue={status ?? ""}
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2"
          >
            <option value="">All</option>
            <option value="awaiting_response">Awaiting Response</option>
            <option value="attending">Attending</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        <button
          type="submit"
          className="min-h-11 rounded bg-accent px-5 py-2 font-medium text-white"
        >
          Apply Filters
        </button>
        {hasFilters && (
          <Link
            href={`/admin/events/${eventId}/invitations`}
            className="flex min-h-11 items-center text-accent underline"
          >
            Clear search and filters
          </Link>
        )}
      </form>
      {invitations.length === 0 && totalInvitationCount === 0 ? (
        <section className="mt-8 rounded border border-border bg-surface p-8">
          <h2 className="font-display text-xl font-semibold">
            No invitations yet
          </h2>
          <p className="mt-2 text-text-muted">
            Create an invitation to generate a personalized guest link.
          </p>
          {canMutate && (
            <Link
              href={`/admin/events/${eventId}/invitations/new`}
              className="mt-5 inline-block text-accent underline"
            >
              Create Invitation
            </Link>
          )}
        </section>
      ) : invitations.length === 0 ? (
        <section className="mt-8 rounded border border-border bg-surface p-8">
          <h2 className="font-display text-xl font-semibold">
            No invitations match your search or filter.
          </h2>
          <Link
            href={`/admin/events/${eventId}/invitations`}
            className="mt-4 inline-block min-h-11 py-2 text-accent underline"
          >
            Clear search and filters
          </Link>
        </section>
      ) : (
        <>
          <div className="mt-8 hidden overflow-hidden rounded border border-border bg-surface xl:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-subtle text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Invitee Name
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    RSVP Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Maximum Party Size
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Attendee Count
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Access
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id} className="border-t border-border">
                    <td className="px-4 py-4 font-medium">
                      {invitation.invitee_name}
                    </td>
                    <td className="px-4 py-4">
                      {rsvpLabel(invitation.rsvps?.status)}
                    </td>
                    <td className="px-4 py-4">
                      {invitation.maximum_party_size}
                    </td>
                    <td className="px-4 py-4">
                      {invitation.rsvps?.attendee_count ?? 0}
                    </td>
                    <td className="px-4 py-4">
                      {invitation.revoked_at ? "Revoked" : "Active"}
                    </td>
                    <td className="px-4 py-4">
                      {updatedLabel(
                        invitation.rsvps?.response_updated_at,
                        event.event_timezone,
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/events/${eventId}/invitations/${invitation.id}`}
                        className="font-medium text-accent underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:hidden">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="rounded border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">
                    {invitation.invitee_name}
                  </h2>
                  <span className="rounded bg-surface-subtle px-2 py-1 text-sm">
                    {rsvpLabel(invitation.rsvps?.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-text-muted">
                  Attendees: {invitation.rsvps?.attendee_count ?? 0} /{" "}
                  {invitation.maximum_party_size}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Access: {invitation.revoked_at ? "Revoked" : "Active"}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Updated:{" "}
                  {updatedLabel(
                    invitation.rsvps?.response_updated_at,
                    event.event_timezone,
                  )}
                </p>
                <Link
                  href={`/admin/events/${eventId}/invitations/${invitation.id}`}
                  className="mt-4 inline-block min-h-11 py-2 font-medium text-accent underline"
                >
                  View Invitation
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
