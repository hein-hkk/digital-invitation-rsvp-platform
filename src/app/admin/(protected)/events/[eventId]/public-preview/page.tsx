import Link from "next/link";
import { notFound } from "next/navigation";
import { EventAnnouncement } from "@/components/public-event/event-announcement";
import {
  getAdminPublicPreview,
  PublicEventError,
} from "@/modules/public-event/service";

export const dynamic = "force-dynamic";

export default async function PublicEventPreview({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  let preview;
  try {
    preview = await getAdminPublicPreview(eventId);
  } catch (error) {
    if (error instanceof PublicEventError && error.code === "EVENT_NOT_FOUND")
      notFound();
    throw error;
  }
  if (!preview) notFound();
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8">
        <div className="rounded border border-border bg-surface p-4 text-sm">
          <strong>Owner preview</strong> — only you can open this preview.
          <Link
            href={`/admin/events/${eventId}/settings`}
            className="ml-3 text-accent underline"
          >
            Back to Settings
          </Link>
        </div>
      </div>
      <EventAnnouncement event={preview.view} coverUrl={preview.coverUrl} />
    </>
  );
}
