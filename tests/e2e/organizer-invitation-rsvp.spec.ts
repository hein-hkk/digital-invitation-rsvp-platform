import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

test("E2E-A-06/09 manages current RSVP and enforces party-size conflict", async ({
  page,
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
        event_title: "Synthetic M8 Browser Event",
        host_display_names: ["Test Host"],
        event_date: "2099-11-29",
        start_time: "18:00",
        end_time: "21:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Test Venue",
        venue_address: "Test Address",
      })
      .select("id")
      .single();
    expect(event.error).toBeNull();
    const eventId = event.data!.id;

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

    await page.goto(`/admin/events/${eventId}/invitations/new`);
    await page.getByLabel("Invitee Name").fill("Synthetic Household");
    await page.getByLabel("Maximum Party Size").fill("3");
    await page.getByRole("button", { name: "Create Invitation" }).click();
    await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}$/);
    const invitationId = page.url().split("/").at(-1)!;

    await page.getByRole("button", { name: "Edit RSVP" }).click();
    await page.getByRole("radio", { name: "Attending" }).check();
    await page.getByLabel("Attendee Count").fill("3");
    await page.getByLabel("Attendee Names (optional)").fill("Alex\nSam");
    await page.getByLabel("Dietary Requirements (optional)").fill("Vegetarian");
    await page.getByRole("button", { name: "Save RSVP" }).click();
    await expect(page.getByText("RSVP saved.")).toBeVisible();
    await expect(page.getByText("Alex\nSam")).toBeVisible();

    const guestMessage = await serviceClient()
      .from("rsvps")
      .update({ guest_message: "Guest-authored note" })
      .eq("invitation_id", invitationId);
    expect(guestMessage.error).toBeNull();
    await page.reload();
    await expect(page.getByText("Guest-authored note")).toBeVisible();
    await page.getByLabel("Maximum Party Size").fill("2");
    await page.getByRole("button", { name: "Save Invitation" }).click();
    await expect(
      page.getByText(/current Attendee Count of 3/).first(),
    ).toBeVisible();
    const unchanged = await serviceClient()
      .from("rsvps")
      .select("attendee_count")
      .eq("invitation_id", invitationId)
      .single();
    expect(unchanged.data?.attendee_count).toBe(3);

    await page.getByRole("button", { name: "Edit RSVP" }).click();
    await expect(page.getByText("Guest-authored note").last()).toBeVisible();
    await expect(page.getByLabel("Guest Message")).toHaveCount(0);
    await page.getByRole("radio", { name: "Declined" }).check();
    await expect(page.getByText("Saving Declined clears")).toBeVisible();
    await page.getByRole("button", { name: "Save RSVP" }).click();
    await expect(page.getByText("RSVP: declined")).toBeVisible();
    const declined = await serviceClient()
      .from("rsvps")
      .select("*")
      .eq("invitation_id", invitationId)
      .single();
    expect(declined.data).toMatchObject({
      status: "declined",
      attendee_count: 0,
      attendee_names: [],
      dietary_requirements: null,
      guest_message: "Guest-authored note",
    });
    await page.getByLabel("Invitee Name").fill("Renamed Household");
    await page.getByLabel("Maximum Party Size").fill("2");
    await page.getByRole("button", { name: "Save Invitation" }).click();
    await expect(page.getByText("Invitation saved.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Renamed Household" }),
    ).toBeVisible();

    const expire = await serviceClient()
      .from("events")
      .update({ event_date: "2000-01-01" })
      .eq("id", eventId);
    expect(expire.error).toBeNull();
    await page.reload();
    await expect(page.getByText("This event is read-only.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Invitation" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit RSVP" })).toHaveCount(
      0,
    );
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
