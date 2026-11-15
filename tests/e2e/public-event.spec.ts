import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PUBLIC_COVER_BUCKET } from "@/modules/public-event/validation";
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

test("Owner enables an unlisted public Event page without exposing Invitation details", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const organizer = await provisionOtpOrganizer();
  const service = serviceClient();
  let eventId: string | null = null;
  try {
    const created = await service
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: "2099-11-20T00:00:00Z",
        event_type: "wedding",
        event_title: "Synthetic Public Celebration",
        host_display_names: ["Alex", "Sam"],
        event_date: "2099-11-29",
        start_time: "18:00",
        end_time: "21:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "PUBLIC VENUE",
        venue_address: "PUBLIC ADDRESS",
        venue_map_url: "https://example.test/private-map",
        venue_arrival_notes: "PRIVATE ARRIVAL NOTES",
        invitation_message: "PRIVATE MESSAGE",
        dress_code: "PRIVATE DRESS CODE",
        organizer_contact_information: "PRIVATE CONTACT",
      })
      .select("id,public_page_id")
      .single();
    if (created.error || !created.data) throw created.error;
    eventId = created.data.id;
    const publicPath = `/events/${created.data.public_page_id}`;

    expect((await request.get(publicPath)).status()).toBe(404);
    expect((await request.get(`${publicPath}/cover`)).status()).toBe(404);

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
    await page
      .getByLabel("Public announcement")
      .fill("The celebration is coming soon!");
    await page.getByRole("button", { name: "Save Announcement" }).click();
    await expect(page.getByRole("status")).toContainText("Settings saved.");
    await page.getByLabel("Upload public cover").setInputFiles({
      name: "public.png",
      mimeType: "image/png",
      buffer: onePixelPng,
    });
    await page.getByRole("button", { name: "Save Public Cover" }).click();
    await expect(page.getByRole("status")).toHaveText("Public cover saved.", {
      timeout: 20_000,
    });

    await page.getByRole("link", { name: "Preview Public Page" }).click();
    await expect(page.getByText("Owner preview")).toBeVisible();
    await expect(
      page.getByText("The celebration is coming soon!"),
    ).toBeVisible();
    await expect(page.getByText("PUBLIC VENUE")).toBeVisible();
    await expect(page.getByText("PUBLIC ADDRESS")).toBeVisible();
    await page.getByRole("link", { name: "Back to Settings" }).click();
    const enable = page.getByRole("button", { name: "Enable Public Page" });
    await expect(enable).toBeEnabled();
    page.once("dialog", (dialog) => dialog.accept());
    await enable.click();
    await expect(page.getByRole("status")).toHaveText(
      "Public page settings saved.",
    );

    const response = await request.get(publicPath);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    const html = await response.text();
    expect(html).toContain('name="robots"');
    for (const publicText of [
      "Synthetic Public Celebration",
      "Alex",
      "Sam",
      "PUBLIC VENUE",
      "PUBLIC ADDRESS",
      "The celebration is coming soon!",
    ])
      expect(html).toContain(publicText);
    for (const privateText of [
      "private-map",
      "PRIVATE ARRIVAL NOTES",
      "PRIVATE MESSAGE",
      "PRIVATE DRESS CODE",
      "PRIVATE CONTACT",
    ])
      expect(html).not.toContain(privateText);
    expect(html).not.toContain("RSVP form");
    const cover = await request.get(`${publicPath}/cover`);
    expect(cover.status()).toBe(200);
    expect(cover.headers()["content-type"]).toContain("image/png");
    expect(cover.headers()["cache-control"]).toContain("no-store");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(publicPath);
    await expect(
      page.getByRole("heading", { name: "The celebration" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.map((violation) => violation.id)).toEqual(
      [],
    );
    await page.goto(`/admin/events/${eventId}/settings`);
    await expect(
      page.getByRole("button", { name: "Disable Public Page" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Disable Public Page" }).click();
    await expect(page.getByRole("status")).toContainText("Public page is off");
    expect((await request.get(publicPath)).status()).toBe(404);
    expect((await request.get(`${publicPath}/cover`)).status()).toBe(404);
  } finally {
    if (eventId) {
      const bucket = service.storage.from(PUBLIC_COVER_BUCKET);
      const listed = await bucket.list(eventId);
      if (listed.data?.length)
        await bucket.remove(
          listed.data.map((file) => `${eventId}/${file.name}`),
        );
    }
    await cleanupOrganizerAccount(organizer.id);
  }
});
