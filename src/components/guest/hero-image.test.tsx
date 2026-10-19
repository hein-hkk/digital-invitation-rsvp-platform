import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { HeroImage } from "./hero-image";

it("collapses a failed decorative Hero Image without a placeholder", () => {
  const { container } = render(
    <HeroImage url="https://example.test/private-image" />,
  );
  const image = container.querySelector("img") as HTMLImageElement;
  expect(image.alt).toBe("");
  fireEvent.error(image);
  expect(container.firstChild).toBeNull();
});
