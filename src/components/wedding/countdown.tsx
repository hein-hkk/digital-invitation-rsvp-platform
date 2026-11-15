"use client";

import { useEffect, useState } from "react";

const UNITS = [
  { label: "Days", ms: 86_400_000 },
  { label: "Hours", ms: 3_600_000 },
  { label: "Minutes", ms: 60_000 },
  { label: "Seconds", ms: 1_000 },
] as const;

/**
 * Decorative countdown to the Event start. `startsAt` is the Event-local start
 * resolved to an instant on the server; `renderedAt` keeps the first client
 * render identical to the server HTML.
 */
export function Countdown({
  startsAt,
  renderedAt,
}: {
  startsAt: number;
  renderedAt: number;
}) {
  const [now, setNow] = useState(renderedAt);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  let remaining = startsAt - now;
  if (remaining <= 0) return null;
  const days = Math.floor(remaining / UNITS[0].ms);

  return (
    <div className="wedding-countdown" data-reveal="up" data-reveal-delay="3">
      <p className="wedding-countdown__title">Counting down</p>
      <p className="sr-only">
        {days === 0
          ? "Less than one day to go."
          : `${days} ${days === 1 ? "day" : "days"} to go.`}
      </p>
      <div className="wedding-countdown__grid" aria-hidden="true">
        {UNITS.map((unit) => {
          const value = Math.floor(remaining / unit.ms);
          remaining -= value * unit.ms;
          return (
            <div key={unit.label} className="wedding-countdown__cell">
              <span className="wedding-countdown__value">
                {String(value).padStart(2, "0")}
              </span>
              <span className="wedding-countdown__label">{unit.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
