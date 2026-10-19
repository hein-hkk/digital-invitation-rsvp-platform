import { describe, expect, it } from "vitest";
import {
  HERO_IMAGE_MAX_BYTES,
  heroImageExtension,
  isEventHeroImagePath,
  matchesHeroImageSignature,
} from "./validation";

const eventId = "82bf4939-8f5e-4fa9-997b-8db611d86d41";
const objectId = "03f4a9ee-7f69-42cc-bbb3-1f5c8021d5e0";

describe("Hero Image validation", () => {
  it("accepts only the approved MIME types and Event-scoped paths", () => {
    expect(heroImageExtension("image/jpeg")).toBe("jpg");
    expect(heroImageExtension("image/png")).toBe("png");
    expect(heroImageExtension("image/webp")).toBe("webp");
    expect(heroImageExtension("image/svg+xml")).toBeNull();
    expect(isEventHeroImagePath(eventId, `${eventId}/${objectId}.jpg`)).toBe(
      true,
    );
    expect(isEventHeroImagePath(eventId, `other/${objectId}.jpg`)).toBe(false);
    expect(isEventHeroImagePath(eventId, `${eventId}/../${objectId}.jpg`)).toBe(
      false,
    );
    expect(HERO_IMAGE_MAX_BYTES).toBe(10_485_760);
  });

  it("checks the declared raster format against the file signature", () => {
    expect(
      matchesHeroImageSignature(Uint8Array.from([255, 216, 255]), "image/jpeg"),
    ).toBe(true);
    expect(
      matchesHeroImageSignature(
        Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      matchesHeroImageSignature(
        Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
        "image/webp",
      ),
    ).toBe(true);
    expect(
      matchesHeroImageSignature(
        new TextEncoder().encode("<svg/>"),
        "image/png",
      ),
    ).toBe(false);
    expect(
      matchesHeroImageSignature(Uint8Array.from([255, 216, 255]), "image/png"),
    ).toBe(false);
  });
});
