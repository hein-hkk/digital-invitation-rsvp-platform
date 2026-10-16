import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/event-form";
import {
  publishEventAction,
  updateEventAction,
} from "@/modules/events/actions";
import { EventServiceError, getEventWorkspace } from "@/modules/events/service";
import {
  eventValuesFromRow,
  validateEventValues,
} from "@/modules/events/schema";

export default async function EventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ publish?: string }>;
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
  const values = eventValuesFromRow(event);
  const publishResult = (await searchParams).publish;
  const publicationErrors =
    publishResult === "blocked" ? validateEventValues(values, true) : {};
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/admin/events/${eventId}`} className="text-accent underline">
        Back to Event
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">Event Settings</h1>
        <span className="rounded bg-surface-subtle px-2 py-1 text-sm font-medium capitalize">
          {runtimeState}
        </span>
      </div>
      {publishResult && (
        <div
          role="alert"
          className="mt-6 rounded bg-danger-soft p-4 text-danger"
        >
          <p className="font-medium">This event can&apos;t be published yet.</p>
          <p>
            {publishResult === "blocked"
              ? "Complete the highlighted fields below."
              : "Review the Event and try again."}
          </p>
        </div>
      )}
      {runtimeState === "ended" ? (
        <dl className="mt-8 space-y-5 rounded border border-border bg-surface p-6">
          {(
            [
              ["Event Type", values.eventType],
              ["Event Title", values.eventTitle],
              [
                "Wedding / Host Display Names",
                values.hostDisplayNames.join(", "),
              ],
              ["Event Date", values.eventDate],
              ["Start Time", values.startTime],
              ["End Time", values.endTime],
              ["Event Timezone", values.eventTimezone],
              ["Venue Name", values.venueName],
              ["Venue Address", values.venueAddress],
              ["Venue Map URL", values.venueMapUrl],
              ["Venue / Arrival Notes", values.venueArrivalNotes],
              [
                "Event Description / Invitation Message",
                values.invitationMessage,
              ],
              ["Dress Code", values.dressCode],
              ["RSVP Deadline", values.rsvpDeadlineLocal],
              [
                "Organizer Contact Information",
                values.organizerContactInformation,
              ],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-text-muted">{label}</dt>
              <dd className="whitespace-pre-wrap">{value || "Not set"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-8">
          <EventForm
            initialValues={values}
            action={updateEventAction.bind(null, eventId)}
            mode={runtimeState === "draft" ? "draft" : "published"}
            publicationErrors={publicationErrors}
          />
          {runtimeState === "draft" && (
            <form
              action={publishEventAction}
              className="mt-8 border-t border-border pt-6"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <button className="rounded border border-accent px-5 py-2 font-medium text-accent">
                Publish Event
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
