import type { Metadata } from "next";
import { GuestRsvpSection } from "@/components/guest/guest-rsvp-section";
import { HeroImage } from "@/components/guest/hero-image";
import {
  resolveGuestInvitation,
  type GuestInvitationView,
} from "@/modules/guest-access/service";
import { submitGuestRsvpAction } from "@/modules/rsvp/guest-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
  description: "A private invitation",
  robots: { index: false, follow: false },
};

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function timeLabel(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function deadlineLabel(deadline: string): string {
  const [date, time] = deadline.split("T");
  return `${dateLabel(date)} at ${timeLabel(time)}`;
}

function GuestInvitation({
  invitation,
  token,
  saved,
}: {
  invitation: GuestInvitationView;
  token: string;
  saved: boolean;
}) {
  const { event, rsvp, permission } = invitation;
  const hosts = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(event.hostDisplayNames);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-12 sm:px-8 sm:pt-20">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          You’re invited
        </p>
        <h1 className="mt-5 font-display text-4xl leading-tight text-text sm:text-6xl">
          {hosts}
        </h1>
        <p className="mt-9 text-sm text-text-muted">For</p>
        <p className="mt-1 font-display text-2xl text-text sm:text-3xl">
          {invitation.inviteeName}
        </p>
        {permission.canEditRsvp && (
          <a
            href="#rsvp"
            className="mt-8 inline-flex min-h-11 items-center rounded-md bg-accent px-7 py-2 font-semibold text-white hover:bg-accent-hover"
          >
            RSVP
          </a>
        )}
      </header>

      {event.heroImageSignedUrl && <HeroImage url={event.heroImageSignedUrl} />}

      <section
        aria-labelledby="event-details"
        className="mt-14 border-y border-border py-9 text-center sm:mt-20"
      >
        <h2 id="event-details" className="font-display text-2xl sm:text-3xl">
          The celebration
        </h2>
        <p className="mt-6 text-lg font-medium">{dateLabel(event.eventDate)}</p>
        <p className="mt-1 text-text-muted">
          {timeLabel(event.startTime)}
          {event.endTime ? ` – ${timeLabel(event.endTime)}` : null}
        </p>
        <div className="mt-7">
          <p className="font-medium">{event.venueName}</p>
          <p className="mt-1 whitespace-pre-line text-text-muted">
            {event.venueAddress}
          </p>
        </div>
      </section>

      {event.invitationMessage && (
        <section
          aria-labelledby="invitation-message"
          className="mt-12 text-center"
        >
          <h2 id="invitation-message" className="font-display text-2xl">
            A note from your hosts
          </h2>
          <p className="mt-5 whitespace-pre-wrap break-words leading-8 text-text-muted">
            {event.invitationMessage}
          </p>
        </section>
      )}

      <GuestRsvpSection
        rsvp={rsvp}
        maximumPartySize={invitation.maximumPartySize}
        canEdit={permission.canEditRsvp}
        deadlineLabel={
          event.rsvpDeadlineLocal
            ? deadlineLabel(event.rsvpDeadlineLocal)
            : null
        }
        saved={saved}
        action={submitGuestRsvpAction.bind(null, token)}
      />

      {(event.venueArrivalNotes || event.venueMapUrl) && (
        <section
          aria-labelledby="venue-details"
          className="mt-12 border-t border-border pt-9"
        >
          <h2 id="venue-details" className="font-display text-2xl">
            Venue details
          </h2>
          {event.venueArrivalNotes && (
            <p className="mt-4 whitespace-pre-wrap break-words leading-7 text-text-muted">
              {event.venueArrivalNotes}
            </p>
          )}
          {event.venueMapUrl && (
            <a
              className="mt-5 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
              href={event.venueMapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Map
            </a>
          )}
        </section>
      )}
      {event.dressCode && (
        <section aria-labelledby="dress-code" className="mt-10">
          <h2 id="dress-code" className="font-display text-2xl">
            Dress Code
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-text-muted">
            {event.dressCode}
          </p>
        </section>
      )}
      {event.organizerContactInformation && (
        <section aria-labelledby="questions" className="mt-10">
          <h2 id="questions" className="font-display text-2xl">
            Questions?
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-text-muted">
            {event.organizerContactInformation}
          </p>
        </section>
      )}
    </main>
  );
}

export default async function GuestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const { saved } = await searchParams;
  const result = await resolveGuestInvitation(token);
  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12 text-center">
        <h1 className="font-display text-3xl">Invitation unavailable</h1>
        <p className="mt-5 text-text-muted">
          This invitation link is not available. Please contact the person who
          shared it with you if you need help.
        </p>
      </main>
    );
  }
  return (
    <GuestInvitation
      invitation={result.value}
      token={token}
      saved={saved === "1"}
    />
  );
}
