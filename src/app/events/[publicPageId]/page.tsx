import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventAnnouncement } from "@/components/public-event/event-announcement";
import { WeddingEnvelope } from "@/components/guest/wedding-envelope";
import { getPublicEventView } from "@/modules/public-event/service";
import { getAppBaseUrl } from "@/server/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicPageId: string }>;
}): Promise<Metadata> {
  const { publicPageId } = await params;
  const event = await getPublicEventView(publicPageId);
  if (!event)
    return {
      title: "Event unavailable",
      robots: { index: false, follow: false },
    };
  return {
    metadataBase: new URL(getAppBaseUrl()),
    title: event.eventTitle,
    description: event.announcement ?? "Save the date for a celebration.",
    robots: { index: false, follow: false },
    openGraph: {
      title: event.eventTitle,
      description: event.announcement ?? "Save the date for a celebration.",
      images: event.hasCover ? [`/events/${event.publicPageId}/cover`] : [],
    },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ publicPageId: string }>;
}) {
  const { publicPageId } = await params;
  const event = await getPublicEventView(publicPageId);
  if (!event) notFound();
  return (
    <WeddingEnvelope hostNames={event.hostDisplayNames}>
      <div>
        <EventAnnouncement
          event={event}
          coverUrl={
            event.hasCover ? `/events/${event.publicPageId}/cover` : null
          }
        />
      </div>
    </WeddingEnvelope>
  );
}
