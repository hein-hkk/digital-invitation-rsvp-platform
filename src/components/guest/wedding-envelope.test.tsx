import { fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WeddingEnvelope } from "./wedding-envelope";

vi.mock("@/components/wedding/fonts", () => ({
  weddingScript: { variable: "font-wedding-script" },
}));

// jsdom has no matchMedia, and it reports toggles after the test body ends.
function reducedMotion(matches: boolean) {
  window.matchMedia = (() => ({ matches })) as unknown as typeof matchMedia;
}

function renderEnvelope(initiallyOpen = false) {
  const view = render(
    <WeddingEnvelope hostNames={["Alex", "Sam"]} initiallyOpen={initiallyOpen}>
      <h1 tabIndex={-1}>Invitation</h1>
    </WeddingEnvelope>,
  );
  const details = view.container.querySelector("details")!;
  const cover = view.container.querySelector("summary")!;
  const heading = view.container.querySelector("h1")!;
  return { details, cover, heading };
}

it("starts closed with the Host Display Names on the cover", () => {
  reducedMotion(false);
  const { details, cover } = renderEnvelope();
  expect(details.open).toBe(false);
  expect(details.dataset.phase).toBe("closed");
  expect(cover.textContent).toContain("Alex and Sam");
});

it("plays the opening sequence once and then focuses the Invitation", () => {
  reducedMotion(false);
  const { details, cover, heading } = renderEnvelope();
  fireEvent.click(cover);
  expect(details.dataset.phase).toBe("opening");

  // A second activation while the cover animates must not close it again.
  expect(fireEvent.click(cover)).toBe(false);

  // jsdom has no AnimationEvent and React may bind the prefixed event name
  // there, so the event is built by hand under both names.
  for (const type of ["animationend", "webkitAnimationEnd"]) {
    const finished = new Event(type, { bubbles: true });
    Object.defineProperty(finished, "animationName", {
      value: "wedding-cover-exit",
    });
    fireEvent(cover, finished);
  }
  expect(details.dataset.phase).toBe("open");
  expect(document.activeElement).toBe(heading);
});

it("skips the sequence when reduced motion is preferred", () => {
  reducedMotion(true);
  const { details, cover, heading } = renderEnvelope();
  fireEvent.click(cover);
  expect(details.dataset.phase).toBe("closed");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  expect(details.dataset.phase).toBe("open");
  expect(document.activeElement).toBe(heading);
});

it("bypasses the envelope for a saved RSVP confirmation", () => {
  reducedMotion(false);
  const { details } = renderEnvelope(true);
  expect(details.open).toBe(true);
  expect(details.dataset.phase).toBe("open");
});
