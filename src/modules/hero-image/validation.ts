export const HERO_IMAGE_BUCKET = "hero-images";
export const HERO_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const HERO_IMAGE_SIGNED_READ_SECONDS = 60;

const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type HeroImageType = keyof typeof extensions;

export function heroImageExtension(value: string): string | null {
  return Object.hasOwn(extensions, value)
    ? extensions[value as HeroImageType]
    : null;
}

export function isEventHeroImagePath(eventId: string, path: string): boolean {
  return new RegExp(
    `^${eventId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
  ).test(path);
}

export function matchesHeroImageSignature(
  bytes: Uint8Array,
  contentType: HeroImageType,
): boolean {
  if (contentType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
    );
  }
  return (
    bytes.length >= 12 &&
    [82, 73, 70, 70].every((byte, i) => bytes[i] === byte) &&
    [87, 69, 66, 80].every((byte, i) => bytes[i + 8] === byte)
  );
}
