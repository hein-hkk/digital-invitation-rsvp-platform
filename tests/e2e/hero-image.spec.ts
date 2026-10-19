import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { HERO_IMAGE_BUCKET } from "@/modules/hero-image/validation";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

process.loadEnvFile(".env.local");

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pXcAAAAASUVORK5CYII=",
  "base64",
);

test("M12 Organizer uploads and removes a private Hero Image; Guest sees the signed image", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const organizer = await provisionOtpOrganizer();
  let eventId: string | null = null;
  try {
    const created = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: "2099-11-20T00:00:00Z",
        event_type: "wedding",
        event_title: "Synthetic Hero Event",
        host_display_names: ["Alex", "Sam"],
        event_date: "2099-11-29",
        start_time: "18:00",
        end_time: "21:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Venue",
        venue_address: "Address",
      })
      .select("id")
      .single();
    if (created.error || !created.data) throw created.error;
    eventId = created.data.id;
    const rawToken = randomBytes(32).toString("base64url");
    const lookupHash = createHmac(
      "sha256",
      Buffer.from(process.env.INVITATION_TOKEN_HASH_KEY!, "base64url"),
    )
      .update(rawToken)
      .digest("hex");
    const invitation = await serviceClient().rpc("create_invitation_record", {
      p_owner_user_id: organizer.id,
      p_event_id: eventId,
      p_invitee_name: "Guest Household",
      p_maximum_party_size: 2,
      p_token_lookup_hash: `\\x${lookupHash}`,
      p_token_ciphertext: "synthetic-hero-test-envelope",
      p_token_key_version: 1,
    });
    if (invitation.error) throw invitation.error;

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

    await page.goto(`/admin/events/${eventId}/settings`);
    await page.getByLabel("Upload image").setInputFiles({
      name: "hero.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    });
    await page.getByRole("button", { name: "Save Hero Image" }).click();
    await expect(page.getByRole("status")).toHaveText("Hero Image saved.", {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("img", { name: "Current Hero Image" }),
    ).toBeVisible();

    await page.goto(`/i/${rawToken}`);
    await expect(page.getByText("Guest Household")).toBeVisible();
    const image = page.locator('img[alt=""]');
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);

    await page.goto(`/admin/events/${eventId}/settings`);
    await page.getByRole("button", { name: "Remove Hero Image" }).click();
    await expect(page.getByRole("status")).toHaveText("Hero Image removed.");
    await page.goto(`/i/${rawToken}`);
    await expect(page.locator('img[alt=""]')).toHaveCount(0);
  } finally {
    if (eventId) {
      const bucket = serviceClient().storage.from(HERO_IMAGE_BUCKET);
      const listed = await bucket.list(eventId);
      if (listed.data?.length)
        await bucket.remove(
          listed.data.map((file) => `${eventId}/${file.name}`),
        );
    }
    await cleanupOrganizerAccount(organizer.id);
  }
});
