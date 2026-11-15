import type { PublicEventView } from "@/modules/public-event/service";

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

export function EventAnnouncement({
  event,
  coverUrl,
}: {
  event: PublicEventView;
  coverUrl: string | null;
}) {
  const hosts = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(event.hostDisplayNames);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-14 sm:px-8 sm:pt-20">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          Save the date
        </p>
        <h1
          tabIndex={-1}
          className="mt-5 font-display text-4xl leading-tight text-text sm:text-6xl"
        >
          {hosts}
        </h1>
        <p className="mt-5 text-lg text-text-muted">{event.eventTitle}</p>
      </header>

      {coverUrl && (
        // The image route checks public visibility on each request. Admin preview
        // uses an authorized short-lived Storage URL while the page is disabled.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={`Public cover for ${event.eventTitle}`}
          className="mt-10 aspect-[4/5] w-full rounded object-cover sm:aspect-[3/2]"
        />
      )}

      <section
        aria-labelledby="public-event-date"
        className="mt-12 border-y border-border py-10 text-center"
      >
        <h2
          id="public-event-date"
          className="font-display text-2xl sm:text-3xl"
        >
          The celebration
        </h2>
        <p className="mt-6 text-lg font-medium">{dateLabel(event.eventDate)}</p>
        <p className="mt-1 text-text-muted">
          {timeLabel(event.startTime)}
          {event.endTime ? ` – ${timeLabel(event.endTime)}` : null}
        </p>
        <div className="mt-8">
          <h3 className="font-display text-xl">Venue</h3>
          <p className="mt-2 text-lg text-text-muted">{event.venueName}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-text-muted">
            {event.venueAddress}
          </p>
        </div>
      </section>

      {event.announcement && (
        <section
          aria-labelledby="public-announcement"
          className="mt-12 text-center"
        >
          <h2 id="public-announcement" className="font-display text-2xl">
            A note from the hosts
          </h2>
          <p className="mt-5 whitespace-pre-wrap break-words leading-8 text-text-muted">
            {event.announcement}
          </p>
        </section>
      )}

      <p className="mt-14 border-t border-border pt-8 text-center text-sm text-text-muted">
        Invitation details and RSVP are available through a personal invitation.
      </p>
    </div>
  );
}
