import { CelebrationSummary } from "@/components/wedding/celebration-summary";
import { monogramInitials } from "@/components/wedding/format";
import { HostNames, hostNamesClass } from "@/components/wedding/host-names";
import { Crest, Flourish } from "@/components/wedding/ornaments";
import { RevealRoot } from "@/components/wedding/reveal-root";
import { WeddingFooter } from "@/components/wedding/wedding-footer";
import type { PublicEventView } from "@/modules/public-event/service";

export function EventAnnouncement({
  event,
  coverUrl,
}: {
  event: PublicEventView;
  coverUrl: string | null;
}) {
  const hosts = event.hostDisplayNames;
  return (
    <RevealRoot>
      <header className="wedding-hero wedding-shell">
        <div data-reveal="zoom">
          <Crest initials={monogramInitials(hosts)} />
        </div>
        <p className="wedding-eyebrow" data-reveal="up" data-reveal-delay="1">
          Save the date
        </p>
        <h1
          tabIndex={-1}
          className={hostNamesClass(hosts)}
          data-reveal="up"
          data-reveal-delay="2"
        >
          <HostNames names={hosts} />
        </h1>
        <div data-reveal="fade" data-reveal-delay="3">
          <Flourish />
        </div>
        <p
          className="wedding-hero__subtitle"
          data-reveal="up"
          data-reveal-delay="4"
        >
          {event.eventTitle}
        </p>
      </header>

      {coverUrl && (
        <div className="wedding-photo" data-reveal="photo">
          <div className="wedding-photo__frame">
            {/* The image route checks public visibility on each request. Admin
                preview uses an authorized short-lived Storage URL while the
                page is disabled. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={`Public cover for ${event.eventTitle}`} />
          </div>
        </div>
      )}

      <CelebrationSummary
        headingId="public-event-date"
        eventDate={event.eventDate}
        startTime={event.startTime}
        endTime={event.endTime}
        eventTimezone={event.eventTimezone}
        venueName={event.venueName}
        venueAddress={event.venueAddress}
      />

      {event.announcement && (
        <section
          aria-labelledby="public-announcement"
          className="wedding-message wedding-shell"
        >
          <span
            className="wedding-message__mark"
            aria-hidden="true"
            data-reveal="zoom"
          />
          <h2
            id="public-announcement"
            className="wedding-label"
            data-reveal="up"
          >
            A note from the hosts
          </h2>
          <p
            className="wedding-message__body"
            data-reveal="up"
            data-reveal-delay="1"
          >
            {event.announcement}
          </p>
        </section>
      )}

      <p className="wedding-notice wedding-shell" data-reveal="up">
        Invitation details and RSVP are available through a personal invitation.
      </p>

      <WeddingFooter hostNames={hosts} />
    </RevealRoot>
  );
}
