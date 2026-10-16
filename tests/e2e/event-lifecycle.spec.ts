import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

test("E2E-A-02/03/04 creates incomplete Draft, blocks publication, and publishes complete Event", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const organizer = await provisionOtpOrganizer();
  try {
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/events");
    await expect(
      page.getByRole("heading", { name: "No events yet" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Create Event" }).first().click();
    await page.getByLabel("Event Title").fill("Synthetic Wedding");
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(page.getByText("draft", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish Event" }).click();
    await expect(page).toHaveURL(/\/settings\?publish=blocked$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("alert").filter({ hasText: "can't be published yet" }),
    ).toContainText("can't be published yet");
    await expect(page.getByText("Venue Name is required.")).toBeVisible();

    await page
      .getByLabel("Wedding / Host Display Names")
      .fill("Host One\nHost Two");
    await page.getByLabel("Event Date").fill("2099-11-20");
    await page.getByLabel("Start Time").fill("18:00");
    await page.getByLabel("Event Timezone").fill("Asia/Bangkok");
    await page.getByLabel("Venue Name").fill("Test Venue");
    await page.getByLabel("Venue Address").fill("Test Address");
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
    await expect(page.getByText("Venue Name is required.")).toHaveCount(0);
    await page.getByRole("button", { name: "Publish Event" }).click();
    await expect(page).toHaveURL(
      /\/admin\/events\/[0-9a-f-]{36}\?published=1$/,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("status")).toHaveText("Event published.");
    await expect(page.getByText("published", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Event Settings" }).click();
    await page.getByLabel("Venue Name").fill("Updated Test Venue");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");

    const ended = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: new Date().toISOString(),
        event_type: "wedding",
        event_title: "Past Synthetic Event",
        host_display_names: ["Test Host"],
        event_date: "2000-01-01",
        start_time: "18:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Past Venue",
        venue_address: "Past Address",
      })
      .select("id")
      .single();
    expect(ended.error).toBeNull();
    await page.goto(`/admin/events/${ended.data!.id}/settings`);
    await expect(page.getByText("ended", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save|Publish/ }),
    ).toHaveCount(0);
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
