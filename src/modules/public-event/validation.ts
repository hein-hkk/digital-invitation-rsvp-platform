import {
  HERO_IMAGE_BUCKET,
  HERO_IMAGE_MAX_BYTES,
  heroImageExtension,
  matchesHeroImageSignature,
  type HeroImageType,
} from "@/modules/hero-image/validation";

export const PUBLIC_COVER_BUCKET = HERO_IMAGE_BUCKET;
export const PUBLIC_COVER_MAX_BYTES = HERO_IMAGE_MAX_BYTES;
export { heroImageExtension, matchesHeroImageSignature };
export type { HeroImageType };

export function isPublicCoverPath(eventId: string, path: string): boolean {
  return new RegExp(
    `^${eventId}/public-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
  ).test(path);
}
