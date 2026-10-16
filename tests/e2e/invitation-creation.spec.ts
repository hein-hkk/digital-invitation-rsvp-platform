import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

test("E2E-A-05/06 creates a Draft Invitation and copies its current link", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const organizer = await provisionOtpOrganizer();
  try {
    const draft = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        event_title: "Synthetic M5 Event",
      })
      .select("id")
      .single();
    expect(draft.error).toBeNull();
    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto(`/admin/events/${draft.data!.id}`);
    await expect(
      page.getByRole("link", { name: "Invitations" }),
    ).toHaveAttribute("href", `/admin/events/${draft.data!.id}/invitations`);
    await page.goto(`/admin/events/${draft.data!.id}/invitations`);
    await expect(
      page.getByRole("heading", { name: "No invitations yet" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Create Invitation" }).first().click();
    await expect(page.getByText("This event is still a draft.")).toBeVisible();
    await page.getByLabel("Invitee Name").fill("Test Household");
    await page.getByLabel("Maximum Party Size").fill("3");
    await page.getByRole("button", { name: "Create Invitation" }).click();
    await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: "Test Household" }),
    ).toBeVisible();
    await expect(page.getByText("Awaiting Response").first()).toBeVisible();
    const url = await page
      .getByLabel("Current personalized Invitation URL")
      .inputValue();
    expect(url).toMatch(/^http:\/\/localhost:3000\/i\/[A-Za-z0-9_-]{43}$/);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy Link" }).click();
    await expect(page.getByRole("status")).toHaveText("Invitation link copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Copy Link" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto(`/admin/events/${draft.data!.id}/invitations`);
    await expect(
      page.getByRole("listitem").getByText("Test Household"),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("row").getByText("Test Household"),
    ).toBeVisible();
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
