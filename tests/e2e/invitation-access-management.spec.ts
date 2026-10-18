import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

test("E2E-A-10/11 and E2E-G-09/10 regenerate, then revoke Guest access", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const organizer = await provisionOtpOrganizer();
  try {
    const event = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: new Date().toISOString(),
        event_type: "wedding",
        event_title: "Synthetic Access Event",
        host_display_names: ["Synthetic Host"],
        event_date: "2099-11-29",
        start_time: "18:00",
        end_time: "21:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Synthetic Venue",
        venue_address: "Synthetic Address",
      })
      .select("id")
      .single();
    if (event.error || !event.data) throw event.error;

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

    await page.goto(`/admin/events/${event.data.id}/invitations/new`);
    await page.getByLabel("Invitee Name").fill("Access Household");
    await page.getByLabel("Maximum Party Size").fill("3");
    await page.getByRole("button", { name: "Create Invitation" }).click();
    await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    });
    const invitationId = new URL(page.url()).pathname.split("/").at(-1)!;
    const originalUrl = await page
      .getByLabel("Current personalized Invitation URL")
      .inputValue();
    await page.goto(new URL(originalUrl).pathname);
    await expect(page.getByText("Access Household")).toBeVisible();
    await page.goto(
      `/admin/events/${event.data.id}/invitations/${invitationId}`,
    );

    await page.getByRole("button", { name: "Regenerate Link" }).click();
    const regenerateDialog = page.getByRole("dialog", {
      name: "Regenerate invitation link?",
    });
    await expect(regenerateDialog).toContainText(
      "The current link will stop working immediately. The RSVP and invitation data will be preserved.",
    );
    await regenerateDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByLabel("Current personalized Invitation URL"),
    ).toHaveValue(originalUrl);
    await page.getByRole("button", { name: "Regenerate Link" }).click();
    await regenerateDialog
      .getByRole("button", { name: "Regenerate Link" })
      .click();
    await expect(page.getByRole("status").first()).toHaveText(
      "A new invitation link was created. The previous link no longer works.",
    );
    const newUrl = await page
      .getByLabel("Current personalized Invitation URL")
      .inputValue();
    expect(newUrl).not.toBe(originalUrl);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy Link" }).click();
    await expect(page.getByRole("status").last()).toHaveText(
      "Invitation link copied",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      newUrl,
    );

    await page.goto(new URL(originalUrl).pathname);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await page.goto(new URL(newUrl).pathname);
    await expect(page.getByText("Access Household")).toBeVisible();
    await page.goto(
      `/admin/events/${event.data.id}/invitations/${invitationId}`,
    );
    await page.getByRole("button", { name: "Revoke Invitation" }).click();
    const revokeDialog = page.getByRole("dialog", {
      name: "Revoke this invitation?",
    });
    await expect(revokeDialog).toContainText(
      "No replacement link will be created.",
    );
    await revokeDialog
      .getByRole("button", { name: "Revoke Invitation" })
      .click();
    await expect(page.getByRole("status").first()).toHaveText(
      "Guest access is revoked.",
    );
    await expect(page.getByText("This Invitation is revoked.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Regenerate Link" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Revoke Invitation" }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Current personalized Invitation URL"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Access Household" }),
    ).toBeVisible();
    await expect(page.getByText("Awaiting Response").first()).toBeVisible();
    await page.goto(new URL(newUrl).pathname);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
