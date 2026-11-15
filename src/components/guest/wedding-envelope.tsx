"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { weddingScript } from "@/components/wedding/fonts";
import { monogramInitials } from "@/components/wedding/format";
import { HostNames, hostNamesClass } from "@/components/wedding/host-names";

type WeddingEnvelopeProps = {
  hostNames: string[];
  initiallyOpen?: boolean;
  children: ReactNode;
};

type Phase = "closed" | "opening" | "open";

// Longer than the CSS opening sequence; only used if `animationend` is missed.
const OPENING_FALLBACK_MS = 3000;

function FlapEdge({ points }: { points: string }) {
  return (
    <svg
      className="wedding-envelope__edge"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      focusable="false"
    >
      <polyline points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function WeddingEnvelope({
  hostNames,
  initiallyOpen = false,
  children,
}: WeddingEnvelopeProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fallbackTimer = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>(initiallyOpen ? "open" : "closed");
  const initials = monogramInitials(hostNames);

  useEffect(
    () => () => {
      if (fallbackTimer.current !== null) {
        window.clearTimeout(fallbackTimer.current);
      }
    },
    [],
  );

  function focusInvitation() {
    contentRef.current?.querySelector<HTMLElement>("h1")?.focus({
      preventScroll: true,
    });
  }

  function finishOpening() {
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    setPhase("open");
    focusInvitation();
  }

  return (
    <main className={weddingScript.variable}>
      <details
        ref={detailsRef}
        className={`wedding-envelope${initiallyOpen ? " wedding-envelope--skip" : ""}`}
        open={initiallyOpen}
        data-phase={phase}
        onToggle={(event) => {
          if (initiallyOpen || !event.currentTarget.open) return;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setPhase("open");
            focusInvitation();
          }
        }}
      >
        <summary
          className="wedding-envelope__cover"
          onClick={(event) => {
            // The cover stays mounted while it animates away; a second
            // activation must not close the Invitation again.
            if (phase !== "closed") {
              event.preventDefault();
              return;
            }
            // Without an opening sequence the server-rendered "closed" phase
            // plus the native open state reveals the Invitation immediately.
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              return;
            }
            setPhase("opening");
            fallbackTimer.current = window.setTimeout(
              finishOpening,
              OPENING_FALLBACK_MS,
            );
          }}
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.animationName === "wedding-cover-exit"
            ) {
              finishOpening();
            }
          }}
        >
          <span className="wedding-envelope__stage" aria-hidden="true">
            <span className="wedding-envelope__shade" />
            <span className="wedding-envelope__flap wedding-envelope__flap--left">
              <span className="wedding-envelope__paper" />
            </span>
            <span className="wedding-envelope__flap wedding-envelope__flap--right">
              <span className="wedding-envelope__paper" />
            </span>
            <span className="wedding-envelope__flap wedding-envelope__flap--bottom">
              <span className="wedding-envelope__paper" />
              <FlapEdge points="0,100 50,46 100,100" />
            </span>
            <span className="wedding-envelope__flap wedding-envelope__flap--top">
              <span className="wedding-envelope__paper" />
              <FlapEdge points="0,22 50,57 100,22" />
              <FlapEdge points="0,17 50,52 100,17" />
            </span>
            <span className="wedding-envelope__seal">
              <span className="wedding-envelope__seal-face">
                {initials.length > 0 ? (
                  <>
                    {initials[0]}
                    {initials[1] && (
                      <>
                        <span className="wedding-envelope__seal-amp">
                          &amp;
                        </span>
                        {initials[1]}
                      </>
                    )}
                  </>
                ) : (
                  "✧"
                )}
              </span>
            </span>
          </span>
          <span className="wedding-envelope__text">
            <span className="wedding-envelope__eyebrow">
              We’re getting married
            </span>
            <span
              className={`wedding-envelope__names ${hostNamesClass(hostNames)}`}
              role="heading"
              aria-level={1}
            >
              <HostNames names={hostNames} />
            </span>
          </span>
          <span className="wedding-envelope__hint">Tap to open</span>
          <span className="wedding-envelope__focus" aria-hidden="true" />
        </summary>
        <div ref={contentRef} className="wedding-envelope__content">
          {children}
        </div>
      </details>
    </main>
  );
}
