import Link from "next/link";
import { notFound } from "next/navigation";
import { EventServiceError, getEventWorkspace } from "@/modules/events/service";
import { publishEventAction } from "@/modules/events/actions";

export default async function EventWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { eventId } = await params;
  let workspace;
  try {
    workspace = await getEventWorkspace(eventId);
  } catch (error) {
    if (error instanceof EventServiceError && error.code === "EVENT_NOT_FOUND")
      notFound();
    throw error;
  }
  const { event, runtimeState } = workspace;
  const published = (await searchParams).published === "1";
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
          <dt className="text-sm text-text-muted">Event Timezone</dt>
          <dd>{event.event_timezone || "Not set"}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
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
