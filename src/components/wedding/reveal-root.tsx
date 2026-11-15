"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { weddingScript } from "./fonts";

/**
 * Wraps the wedding page and plays section entrances as they scroll into view.
 *
 * Content is fully visible in the server HTML. Entrances are armed only after
 * hydration, only for elements that are not already on screen, and never when
 * the Guest prefers reduced motion, so nothing depends on this effect.
 */
export function RevealRoot({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealState = "in";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    const armed: HTMLElement[] = [];
    for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      const collapsed = element.closest("details:not([open])") !== null;
      const box = element.getBoundingClientRect();
      const onScreen =
        !collapsed &&
        box.width > 0 &&
        box.top < window.innerHeight &&
        box.bottom > 0;
      if (onScreen) continue;
      element.dataset.revealState = "pending";
      armed.push(element);
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      for (const element of armed) delete element.dataset.revealState;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`wedding-page ${weddingScript.variable} ${className}`}
    >
      {children}
    </div>
  );
}
