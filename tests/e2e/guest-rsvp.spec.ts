import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

process.loadEnvFile(".env.local");

test("E2E-G-02 through 07: Guest RSVP lifecycle and deadline race on a phone", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const organizer = await provisionOtpOrganizer();
  try {
    const event = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: "2099-11-20T00:00:00Z",
        event_type: "wedding",
        event_title: "Synthetic RSVP Event",
        host_display_names: ["Synthetic Host"],
        event_date: "2099-11-29",
        start_time: "18:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Synthetic Venue",
        venue_address: "Test Address",
      })
      .select("id")
      .single();
    if (event.error || !event.data) throw event.error;
    const rawToken = randomBytes(32).toString("base64url");
    const hashKey = Buffer.from(
      process.env.INVITATION_TOKEN_HASH_KEY!,
      "base64url",
    );
    const lookupHash = createHmac("sha256", hashKey)
      .update(rawToken)
      .digest("hex");
    const invitation = await serviceClient().rpc("create_invitation_record", {
      p_owner_user_id: organizer.id,
      p_event_id: event.data.id,
      p_invitee_name: "RSVP Household",
      p_maximum_party_size: 3,
      p_token_lookup_hash: `\\x${lookupHash}`,
      p_token_ciphertext: "synthetic-m7-envelope",
      p_token_key_version: 1,
    });
    if (invitation.error || !invitation.data) throw invitation.error;
    const path = `/i/${rawToken}`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(
      page.getByRole("radio", { name: "Attending" }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("radio", { name: "Declined" }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Submit RSVP" }).click();
    await expect(
      page.getByText("Choose Attending or Declined.").first(),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Attending" }).check();
    await page.getByLabel("How many people will attend?").selectOption("3");
    await page.getByRole("button", { name: "Add attendee name" }).click();
    await page
      .getByRole("textbox", { name: "Attendee name 1", exact: true })
      .fill("First Guest");
    await page.getByLabel("Dietary requirements").fill("Vegetarian");
    await page.getByLabel("Message for the hosts").fill("Thank you!");
    await page.screenshot({
      path: "test-results/m7-guest-form-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Submit RSVP" }).click();
    await expect(page.getByText("Your RSVP has been saved.")).toBeVisible();
    await expect(page.getByText("3 attending")).toBeVisible();
    await expect(page.getByText("First Guest")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update RSVP" }),
    ).toBeVisible();
    let stored = await serviceClient()
      .from("rsvps")
      .select(
        "status,attendee_count,attendee_names,dietary_requirements,guest_message,responded_at,response_updated_at",
      )
      .eq("invitation_id", invitation.data)
      .single();
    expect(stored.data).toMatchObject({
      status: "attending",
      attendee_count: 3,
      attendee_names: ["First Guest"],
      dietary_requirements: "Vegetarian",
      guest_message: "Thank you!",
    });
    expect(stored.data?.responded_at).toBeTruthy();

    await page.getByRole("button", { name: "Update RSVP" }).click();
    await page.getByLabel("How many people will attend?").selectOption("2");
    await page.getByRole("button", { name: "Add attendee name" }).click();
    await page
      .getByRole("textbox", { name: "Attendee name 2", exact: true })
      .fill("Second Guest");
    await page.getByLabel("How many people will attend?").selectOption("1");
    await expect(
      page.getByText(
        "You have more attendee names than the selected attendee count.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Attendee name 2", exact: true }),
    ).toHaveValue("Second Guest");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      page.getByRole("textbox", { name: "Attendee name 2", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Remove attendee name 2" }).click();
    await page.getByRole("radio", { name: "Declined" }).check();
    await expect(
      page.getByText(
        "Changing to Declined will remove the attendee count, attendee names, and dietary requirements from your RSVP.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("radio", { name: "Declined" })).toHaveCount(0);
    await expect(page.getByText("Your RSVP has been saved.")).toBeVisible();
    stored = await serviceClient()
      .from("rsvps")
      .select(
        "status,attendee_count,attendee_names,dietary_requirements,guest_message,responded_at,response_updated_at",
      )
      .eq("invitation_id", invitation.data)
      .single();
    expect(stored.data).toMatchObject({
      status: "declined",
      attendee_count: 0,
      attendee_names: [],
      dietary_requirements: null,
      guest_message: "Thank you!",
    });

    await page.getByRole("button", { name: "Update RSVP" }).click();
    await page.getByRole("radio", { name: "Attending" }).check();
    await page.getByLabel("How many people will attend?").selectOption("1");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("1 attending")).toBeVisible();
    await page.getByRole("button", { name: "Update RSVP" }).click();
    await page.getByLabel("How many people will attend?").selectOption("2");
    const deadline = await serviceClient()
      .from("events")
      .update({ rsvp_deadline_local: "2000-01-01T00:00:00" })
      .eq("id", event.data.id);
    if (deadline.error) throw deadline.error;
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      page.getByText("RSVP changes are now closed.").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Update RSVP" })).toHaveCount(
      0,
    );
    stored = await serviceClient()
      .from("rsvps")
      .select("attendee_count")
      .eq("invitation_id", invitation.data)
      .single();
    expect(stored.data?.attendee_count).toBe(1);

    const reopen = await serviceClient()
      .from("events")
      .update({ rsvp_deadline_local: null })
      .eq("id", event.data.id);
    if (reopen.error) throw reopen.error;
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Update RSVP" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
