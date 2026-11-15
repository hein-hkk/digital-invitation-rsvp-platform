"use client";

import { useEffect, useRef, type ReactNode } from "react";

type WeddingEnvelopeProps = {
  hostNames: string[];
  initiallyOpen?: boolean;
  children: ReactNode;
};

export function WeddingEnvelope({
  hostNames,
  initiallyOpen = false,
  children,
}: WeddingEnvelopeProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hosts = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(hostNames);
  const monogram = hostNames
    .slice(0, 2)
    .map((name) => name.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join(" & ");

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.dataset.enhanced = "true";
  }, []);

  function focusInvitation() {
    contentRef.current?.querySelector<HTMLElement>("h1")?.focus({
      preventScroll: true,
    });
  }

  return (
    <main>
      <details
        ref={detailsRef}
        className={`wedding-envelope${initiallyOpen ? " wedding-envelope--skip" : ""}`}
        open={initiallyOpen}
        onToggle={(event) => {
          if (
            !initiallyOpen &&
            event.currentTarget.open &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            focusInvitation();
          }
        }}
      >
        <summary
          className="wedding-envelope__cover"
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              detailsRef.current?.open
            ) {
              focusInvitation();
            }
          }}
        >
          <span className="wedding-envelope__frame" aria-hidden="true" />
          <span className="wedding-envelope__scene">
            <span className="wedding-envelope__eyebrow">
              We’re getting married
            </span>
            <span
              className="wedding-envelope__names"
              role="heading"
              aria-level={1}
            >
              {hosts}
            </span>
            <span className="wedding-envelope__illustration" aria-hidden="true">
              <svg
                className="wedding-envelope__sprig wedding-envelope__sprig--left"
                viewBox="0 0 110 180"
                fill="none"
              >
                <path d="M99 170C72 134 41 107 38 13" />
                <path d="M67 132C38 130 20 115 10 92M51 96C24 92 13 76 8 54M42 54C62 50 76 36 82 13" />
                <path d="M37 115C29 98 18 96 8 99c5 14 15 22 29 16ZM28 78C20 60 12 58 3 61c3 14 10 22 25 17ZM49 62c17-8 27-21 29-36-17 3-27 13-29 36ZM54 103c17-4 29-15 35-30-18-1-29 8-35 30Z" />
                <circle cx="38" cy="13" r="7" />
                <circle cx="8" cy="54" r="5" />
              </svg>
              <span className="wedding-envelope__paper-back" />
              <span className="wedding-envelope__letter">
                <span className="wedding-envelope__letter-mark">✧</span>
                <span className="wedding-envelope__letter-rule" />
              </span>
              <span className="wedding-envelope__fold wedding-envelope__fold--left" />
              <span className="wedding-envelope__fold wedding-envelope__fold--right" />
              <span className="wedding-envelope__front" />
              <span className="wedding-envelope__flap" />
              <span className="wedding-envelope__seal">{monogram || "✧"}</span>
              <svg
                className="wedding-envelope__sprig wedding-envelope__sprig--right"
                viewBox="0 0 110 180"
                fill="none"
              >
                <path d="M99 170C72 134 41 107 38 13" />
                <path d="M67 132C38 130 20 115 10 92M51 96C24 92 13 76 8 54M42 54C62 50 76 36 82 13" />
                <path d="M37 115C29 98 18 96 8 99c5 14 15 22 29 16ZM28 78C20 60 12 58 3 61c3 14 10 22 25 17ZM49 62c17-8 27-21 29-36-17 3-27 13-29 36ZM54 103c17-4 29-15 35-30-18-1-29 8-35 30Z" />
                <circle cx="38" cy="13" r="7" />
                <circle cx="8" cy="54" r="5" />
              </svg>
            </span>

            <span className="wedding-envelope__hint">Open the envelope</span>
          </span>
        </summary>
        <div ref={contentRef} className="wedding-envelope__content">
          {children}
        </div>
      </details>
    </main>
  );
}
