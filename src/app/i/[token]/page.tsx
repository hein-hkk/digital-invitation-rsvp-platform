import type { Metadata } from "next";
import { GuestRsvpSection } from "@/components/guest/guest-rsvp-section";
import { HeroImage } from "@/components/guest/hero-image";
import { WeddingEnvelope } from "@/components/guest/wedding-envelope";
import { CelebrationSummary } from "@/components/wedding/celebration-summary";
import { deadlineLabel, monogramInitials } from "@/components/wedding/format";
import { HostNames, hostNamesClass } from "@/components/wedding/host-names";
import {
  ArrowOutIcon,
  AttireIcon,
  ContactIcon,
  Crest,
  Flourish,
  PinIcon,
} from "@/components/wedding/ornaments";
import { RevealRoot } from "@/components/wedding/reveal-root";
import { WeddingFooter } from "@/components/wedding/wedding-footer";
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
  const hosts = event.hostDisplayNames;

  return (
    <RevealRoot>
      <header className="wedding-hero wedding-shell">
        <div data-reveal="zoom">
          <Crest initials={monogramInitials(hosts)} />
        </div>
        <p className="wedding-eyebrow" data-reveal="up" data-reveal-delay="1">
          You’re invited
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
        <div className="wedding-invitee" data-reveal="up" data-reveal-delay="4">
          <p className="wedding-label">For</p>
          <p className="wedding-invitee__name">{invitation.inviteeName}</p>
        </div>
        {permission.canEditRsvp && (
          <p
            className="wedding-hero__action"
            data-reveal="up"
            data-reveal-delay="5"
          >
            <a href="#rsvp" className="wedding-button">
              RSVP
            </a>
          </p>
        )}
      </header>

      {event.heroImageSignedUrl && <HeroImage url={event.heroImageSignedUrl} />}

      <CelebrationSummary
        headingId="event-details"
        eventDate={event.eventDate}
        startTime={event.startTime}
        endTime={event.endTime}
        eventTimezone={event.eventTimezone}
        venueName={event.venueName}
        venueAddress={event.venueAddress}
      />

      {event.invitationMessage && (
        <section
          aria-labelledby="invitation-message"
          className="wedding-message wedding-shell"
        >
          <span
            className="wedding-message__mark"
            aria-hidden="true"
            data-reveal="zoom"
          />
          <h2
            id="invitation-message"
            className="wedding-label"
            data-reveal="up"
          >
            A note from your hosts
          </h2>
          <p
            className="wedding-message__body"
            data-reveal="up"
            data-reveal-delay="1"
          >
            {event.invitationMessage}
          </p>
          <p
            className="wedding-message__signature"
            aria-hidden="true"
            data-reveal="up"
            data-reveal-delay="2"
          >
            <HostNames names={hosts} />
          </p>
        </section>
      )}

      {/* A just-saved RSVP confirmation is never held back by an entrance. */}
      <div className="wedding-shell" data-reveal={saved ? undefined : "up"}>
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
      </div>

      {(event.venueArrivalNotes ||
        event.venueMapUrl ||
        event.dressCode ||
        event.organizerContactInformation) && (
        <div className="wedding-details wedding-shell">
          {(event.venueArrivalNotes || event.venueMapUrl) && (
            <section
              aria-labelledby="venue-details"
              className="wedding-detail"
              data-reveal="up"
            >
              <PinIcon />
              <h2 id="venue-details" className="wedding-detail__title">
                Venue details
              </h2>
              {event.venueArrivalNotes && (
                <p className="wedding-detail__text">
                  {event.venueArrivalNotes}
                </p>
              )}
              {event.venueMapUrl && (
                <a
                  className="wedding-button wedding-button--quiet"
                  href={event.venueMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Map
                  <ArrowOutIcon />
                </a>
              )}
            </section>
          )}
          {event.dressCode && (
            <section
              aria-labelledby="dress-code"
              className="wedding-detail"
              data-reveal="up"
              data-reveal-delay="1"
            >
              <AttireIcon />
              <h2 id="dress-code" className="wedding-detail__title">
                Dress Code
              </h2>
              <p className="wedding-detail__text">{event.dressCode}</p>
            </section>
          )}
          {event.organizerContactInformation && (
            <section
              aria-labelledby="questions"
              className="wedding-detail"
              data-reveal="up"
              data-reveal-delay="2"
            >
              <ContactIcon />
              <h2 id="questions" className="wedding-detail__title">
                Questions?
              </h2>
              <p className="wedding-detail__text">
                {event.organizerContactInformation}
              </p>
            </section>
          )}
        </div>
      )}

      <WeddingFooter hostNames={hosts} />
    </RevealRoot>
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
    <WeddingEnvelope
      hostNames={result.value.event.hostDisplayNames}
      initiallyOpen={saved === "1"}
    >
      <GuestInvitation
        invitation={result.value}
        token={token}
        saved={saved === "1"}
      />
    </WeddingEnvelope>
  );
}
