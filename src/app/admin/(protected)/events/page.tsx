import Link from "next/link";
import { listOwnedEvents } from "@/modules/events/service";

const badge = {
  draft: "bg-surface-subtle text-text-muted",
  published: "bg-success-soft text-success",
  ended: "bg-surface-subtle text-text-muted",
};

export default async function EventsIndex() {
  const events = await listOwnedEvents();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Events</h1>
        <Link
          href="/admin/events/new"
          className="rounded bg-accent px-4 py-2 font-medium text-white"
        >
          Create Event
        </Link>
      </div>
      {events.length === 0 ? (
        <section className="mt-10 rounded border border-border bg-surface p-8">
          <h2 className="font-display text-xl font-semibold">No events yet</h2>
          <p className="mt-2 text-text-muted">
            Create your first event to start setting up invitations and RSVPs.
          </p>
          <Link
            href="/admin/events/new"
            className="mt-5 inline-block rounded bg-accent px-4 py-2 font-medium text-white"
          >
            Create Event
          </Link>
        </section>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">
                  {event.eventTitle || "Untitled Event"}
                </h2>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium capitalize ${badge[event.runtimeState]}`}
                >
                  {event.runtimeState}
                </span>
              </div>
              {event.eventDate && (
                <p className="mt-3 text-text-muted">{event.eventDate}</p>
              )}
              {event.venueName && (
                <p className="text-text-muted">{event.venueName}</p>
              )}
              {event.runtimeState === "draft" &&
                (!event.eventTitle || !event.eventDate) && (
                  <p className="mt-2 text-sm text-warning">Setup incomplete</p>
                )}
              <Link
                href={`/admin/events/${event.id}`}
                className="mt-4 inline-block font-medium text-accent underline"
              >
                Manage Event
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
