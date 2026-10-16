import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
  syntheticHash,
} from "../helpers/local-supabase";

process.loadEnvFile(".env.local");

test("E2E-A-07/08/12 and E2E-G-08: overview, combined filters, and deadline reopening", async ({
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
        event_title: "Synthetic M9 Event",
        host_display_names: ["Test Host"],
        event_date: "2099-11-29",
        start_time: "18:00",
        end_time: "21:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Test Venue",
        venue_address: "Test Address",
        rsvp_deadline_local: "2020-01-01T00:00:00",
      })
      .select("id")
      .single();
    expect(event.error).toBeNull();
    const eventId = event.data!.id;
    const rawToken = randomBytes(32).toString("base64url");
    const guestHash = `\\x${createHmac(
      "sha256",
      Buffer.from(process.env.INVITATION_TOKEN_HASH_KEY!, "base64url"),
    )
      .update(rawToken)
      .digest("hex")}`;
    const labels = [
      "John & Family",
      "Joanna Household",
      "Mary Family",
      "Declined Family",
      "Awaiting Household",
    ];
    const invitationIds: string[] = [];
    for (const [index, label] of labels.entries()) {
      const created = await serviceClient().rpc("create_invitation_record", {
        p_owner_user_id: organizer.id,
        p_event_id: eventId,
        p_invitee_name: label,
        p_maximum_party_size: 3,
        p_token_lookup_hash:
          index === 0 ? guestHash : syntheticHash(`${label}:${randomUUID()}`),
        p_token_ciphertext: `synthetic-m9-envelope-${randomUUID()}`,
        p_token_key_version: 1,
      });
      expect(created.error).toBeNull();
      invitationIds.push(created.data!);
    }
    for (const [index, count] of [
      [0, 2],
      [1, 3],
    ] as const) {
      const response = await serviceClient()
        .from("rsvps")
        .update({ status: "attending", attendee_count: count })
        .eq("invitation_id", invitationIds[index]);
      expect(response.error).toBeNull();
    }
    const declined = await serviceClient()
      .from("rsvps")
      .update({ status: "declined" })
      .eq("invitation_id", invitationIds[3]);
    expect(declined.error).toBeNull();

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto(`/admin/events/${eventId}`);
    for (const [label, value] of [
      ["Total Invitations", "5"],
      ["Attending Invitations", "2"],
      ["Declined Invitations", "1"],
      ["Awaiting Response Invitations", "2"],
      ["Total Expected Attendees", "5"],
    ]) {
      await expect(
        page.locator("dt", { hasText: label }).locator("..").locator("dd"),
      ).toHaveText(value);
    }
    await expect(page.getByText("Guest RSVP: Closed")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Change RSVP Deadline" }),
    ).toHaveAttribute(
      "href",
      `/admin/events/${eventId}/settings#rsvp-settings`,
    );

    await page.goto(`/admin/events/${eventId}/invitations`);
    await page.getByLabel("Search by invitee name").fill(" FAMILY ");
    await page.getByLabel("RSVP Status").selectOption("attending");
    await page.getByRole("button", { name: "Apply Filters" }).click();
    await expect(
      page.getByRole("row", { name: /John & Family/ }),
    ).toBeVisible();
    await expect(page.getByRole("row", { name: /Mary Family/ })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("status")).toBe("attending");
    await page.reload();
    await expect(page.getByLabel("Search by invitee name")).toHaveValue(
      "FAMILY",
    );
    await expect(page.getByLabel("RSVP Status")).toHaveValue("attending");
    await page.getByLabel("Search by invitee name").fill("missing");
    await page.getByRole("button", { name: "Apply Filters" }).click();
    await expect(
      page.getByText("No invitations match your search or filter."),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Clear search and filters" })
      .last()
      .click();
    await expect(page.getByRole("row", { name: /Mary Family/ })).toBeVisible();

    const guestPath = `/i/${rawToken}`;
    await page.goto(guestPath);
    await expect(page.getByText("RSVP changes are now closed.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit RSVP" })).toHaveCount(
      0,
    );
    await page.goto(`/admin/events/${eventId}`);
    await page.getByRole("link", { name: "Change RSVP Deadline" }).click();
    await expect(page).toHaveURL(new RegExp(`/settings#rsvp-settings$`));
    await page.getByLabel("RSVP Deadline (optional)").fill("2099-11-28T18:00");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.goto(`/admin/events/${eventId}`);
    await expect(
      page.getByText("Guest RSVP: Open", { exact: true }),
    ).toBeVisible();
    await page.goto(guestPath);
    await expect(
      page.getByRole("button", { name: "Update RSVP" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Update RSVP" }).click();
    await page.getByRole("radio", { name: "Declined" }).check();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Your RSVP has been saved.")).toBeVisible();

    await page.goto(`/admin/events/${eventId}/settings#rsvp-settings`);
    await page.getByLabel("RSVP Deadline (optional)").fill("");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.goto(`/admin/events/${eventId}`);
    await expect(
      page.getByText("Guest RSVP: Open until the event ends"),
    ).toBeVisible();
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
