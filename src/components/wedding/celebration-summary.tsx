import { eventLocalToInstant } from "@/modules/events/domain";
import { Countdown } from "./countdown";
import { dateLabel, dateParts, timeRangeLabel } from "./format";

function startInstant(date: string, time: string, timeZone: string) {
  try {
    return eventLocalToInstant(`${date}T${time}`, timeZone).getTime();
  } catch {
    // The countdown is decorative; the written date and time remain complete.
    return null;
  }
}

/** Event Summary shared by the personalized Invitation and the public page. */
export function CelebrationSummary({
  headingId,
  eventDate,
  startTime,
  endTime,
  eventTimezone,
  venueName,
  venueAddress,
}: {
  headingId: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  eventTimezone: string;
  venueName: string;
  venueAddress: string;
}) {
  const parts = dateParts(eventDate);
  const startsAt = startInstant(eventDate, startTime, eventTimezone);
  return (
    <section aria-labelledby={headingId} className="wedding-band">
      <div className="wedding-shell">
        <p className="wedding-eyebrow" data-reveal="up">
          When &amp; where
        </p>
        <h2
          id={headingId}
          className="wedding-title"
          data-reveal="up"
          data-reveal-delay="1"
        >
          The celebration
        </h2>

        <p className="sr-only">{dateLabel(eventDate)}</p>
        <div
          className="wedding-date"
          aria-hidden="true"
          data-reveal="up"
          data-reveal-delay="2"
        >
          <span className="wedding-date__month">{parts.month}</span>
          <span className="wedding-date__side">{parts.weekday}</span>
          <span className="wedding-date__day">{parts.day}</span>
          <span className="wedding-date__side">{parts.year}</span>
        </div>
        <p className="wedding-time" data-reveal="up" data-reveal-delay="3">
          {timeRangeLabel(startTime, endTime)}
        </p>

        {startsAt !== null && (
          <Countdown startsAt={startsAt} renderedAt={Date.now()} />
        )}

        <span className="wedding-stem" aria-hidden="true" data-reveal="line" />

        <div className="wedding-venue" data-reveal="up">
          <h3 className="wedding-label">Venue</h3>
          <p className="wedding-venue__name">{venueName}</p>
          <p className="wedding-venue__address">{venueAddress}</p>
        </div>
      </div>
    </section>
  );
}
