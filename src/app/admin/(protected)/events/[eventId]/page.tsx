import Link from "next/link";
import { notFound } from "next/navigation";
import { EventServiceError, getEventOverview } from "@/modules/events/service";
import { publishEventAction } from "@/modules/events/actions";

export default async function EventWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { eventId } = await params;
  let overview;
  try {
    overview = await getEventOverview(eventId);
  } catch (error) {
    if (error instanceof EventServiceError && error.code === "EVENT_NOT_FOUND")
      notFound();
    throw error;
  }
  const { event, runtimeState, guestRsvpPolicy } = overview;
  const published = (await searchParams).published === "1";
  const deadlineLabel = guestRsvpPolicy.deadlineLocal
    ? `${guestRsvpPolicy.deadlineLocal.replace("T", " ")} (${event.event_timezone})`
    : null;
  const metrics = [
    ["Total Invitations", overview.totalInvitations],
    ["Attending Invitations", overview.attendingInvitations],
    ["Declined Invitations", overview.declinedInvitations],
    ["Awaiting Response Invitations", overview.awaitingResponseInvitations],
    ["Total Expected Attendees", overview.totalExpectedAttendees],
  ] as const;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/events" className="text-accent underline">
        Back to Events
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">
          {event.event_title || "Untitled Event"}
        </h1>
        <span className="rounded bg-surface-subtle px-2 py-1 text-sm font-medium capitalize">
          {runtimeState}
        </span>
      </div>
      {published && (
        <p
          role="status"
          className="mt-5 rounded bg-success-soft p-3 text-success"
        >
          Event published.
        </p>
      )}
      {runtimeState === "ended" && (
        <p className="mt-5 rounded bg-surface-subtle p-3 text-text-muted">
          This Event has ended. Its settings are read-only.
        </p>
      )}
      <section aria-labelledby="overview-metrics" className="mt-8">
        <h2
          id="overview-metrics"
          className="font-display text-2xl font-semibold"
        >
          Attendance overview
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div
              key={label}
              className="rounded border border-border bg-surface p-5"
            >
              <dt className="text-sm text-text-muted">{label}</dt>
              <dd className="mt-2 font-display text-3xl font-semibold">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section
        aria-labelledby="guest-rsvp-availability"
        className="mt-6 rounded border border-border bg-surface p-6"
      >
        <h2
          id="guest-rsvp-availability"
          className="font-display text-2xl font-semibold"
        >
          Guest RSVP availability
        </h2>
        {runtimeState === "draft" ? (
          <p className="mt-3">
            Guest RSVP is unavailable until the Event is published.
          </p>
        ) : guestRsvpPolicy.state === "ended" ? (
          <p className="mt-3">Guest access: Ended</p>
        ) : guestRsvpPolicy.state === "closed" ? (
          <>
            <p className="mt-3">Guest RSVP: Closed</p>
            <p className="mt-1 text-text-muted">
              Deadline passed{deadlineLabel ? `: ${deadlineLabel}` : ""}
            </p>
            <Link
              href={`/admin/events/${eventId}/settings#rsvp-settings`}
              className="mt-4 inline-block min-h-11 py-2 text-accent underline"
            >
              Change RSVP Deadline
            </Link>
          </>
        ) : deadlineLabel ? (
          <>
            <p className="mt-3">Guest RSVP: Open</p>
            <p className="mt-1 text-text-muted">Deadline: {deadlineLabel}</p>
          </>
        ) : (
          <p className="mt-3">Guest RSVP: Open until the event ends</p>
        )}
      </section>
      <dl className="mt-8 grid gap-5 rounded border border-border bg-surface p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-text-muted">Event Date</dt>
          <dd>{event.event_date || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Venue Name</dt>
          <dd>{event.venue_name || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Start Time</dt>
          <dd>{event.start_time || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">RSVP Deadline</dt>
          <dd>{deadlineLabel || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Event Timezone</dt>
          <dd>{event.event_timezone || "Not set"}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        {runtimeState !== "ended" && (
          <Link
            href={`/admin/events/${eventId}/invitations/new`}
            className="rounded bg-accent px-4 py-2 font-medium text-white"
          >
            Create Invitation
          </Link>
        )}
        <Link
          href={`/admin/events/${eventId}/invitations`}
          className="rounded border border-border-strong px-4 py-2 font-medium"
        >
          Invitations
        </Link>
        <Link
          href={`/admin/events/${eventId}/settings`}
          className="rounded border border-border-strong px-4 py-2 font-medium"
        >
          {runtimeState === "ended" ? "View Event Settings" : "Event Settings"}
        </Link>
        {runtimeState === "draft" && (
          <form action={publishEventAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <button className="rounded bg-accent px-4 py-2 font-medium text-white">
              Publish Event
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
