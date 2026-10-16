import Link from "next/link";
import { EventForm } from "@/components/admin/event-form";
import { createEventDraftAction } from "@/modules/events/actions";
import { emptyEventValues } from "@/modules/events/schema";

export default function NewEventPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin/events" className="text-accent underline">
        Back to Events
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold">Create Event</h1>
      <p className="mt-2 mb-8 text-text-muted">
        Save an incomplete Draft and finish its settings later.
      </p>
      <EventForm
        initialValues={{ ...emptyEventValues, eventType: "wedding" }}
        action={createEventDraftAction}
        mode="create"
      />
    </main>
  );
}
