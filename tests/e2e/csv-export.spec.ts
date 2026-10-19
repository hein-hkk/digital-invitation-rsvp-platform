import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
  syntheticHash,
} from "../helpers/local-supabase";

test("E2E-A-13/14 downloads an Event CSV including Ended records", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const organizer = await provisionOtpOrganizer();
  const stranger = await provisionOtpOrganizer();
  try {
    const event = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: new Date().toISOString(),
        event_type: "wedding",
        event_title: "Synthetic CSV Event",
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
    const eventId = event.data.id;
    const invitationIds: string[] = [];
    for (const name of [
      "=Attending Household",
      "Declined Household",
      "Awaiting Household",
    ]) {
      const invitation = await serviceClient().rpc("create_invitation_record", {
        p_owner_user_id: organizer.id,
        p_event_id: eventId,
        p_invitee_name: name,
        p_maximum_party_size: 3,
        p_token_lookup_hash: syntheticHash(randomUUID()),
        p_token_ciphertext: `synthetic-csv-envelope-${randomUUID()}`,
        p_token_key_version: 1,
      });
      if (invitation.error || !invitation.data) throw invitation.error;
      invitationIds.push(invitation.data);
    }
    const attending = await serviceClient()
      .from("rsvps")
      .update({
        status: "attending",
        attendee_count: 2,
        attendee_names: ["=Alex", "Sam"],
        guest_message: "+Thanks",
      })
      .eq("invitation_id", invitationIds[0]);
    expect(attending.error).toBeNull();
    const declined = await serviceClient()
      .from("rsvps")
      .update({ status: "declined" })
      .eq("invitation_id", invitationIds[1]);
    expect(declined.error).toBeNull();

    const path = `/admin/events/${eventId}/export.csv`;
    const unauthenticated = await request.get(path);
    expect(unauthenticated.status()).toBe(401);
    expect(unauthenticated.headers()["cache-control"]).toBe(
      "private, no-store",
    );

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.goto(`/admin/events/${eventId}/invitations?status=attending`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("synthetic-csv-event-rsvp.csv");
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(4);
    expect(csv).toContain("'=Attending Household,Attending,3,2,'=Alex; Sam");
    expect(csv).toContain("Declined Household,Declined,3,0");
    expect(csv).toContain("Awaiting Household,Awaiting Response,3,0");
    expect(csv).toContain("'+Thanks");
    for (const id of [eventId, ...invitationIds]) expect(csv).not.toContain(id);
    expect(csv).not.toContain("token_lookup_hash");
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "text/csv; charset=utf-8",
    );
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect(response.headers()["cache-control"]).toBe("private, no-store");

    await page.route(`**${path}`, (route) =>
      route.fulfill({ status: 500, body: "Synthetic export failure" }),
    );
    await page.getByRole("button", { name: "Export CSV" }).click();
    await expect(
      page.getByText("We couldn't export the CSV. Please try again.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute(`**${path}`);

    const endEvent = await serviceClient()
      .from("events")
      .update({ event_date: "2000-01-01" })
      .eq("id", eventId);
    expect(endEvent.error).toBeNull();
    await page.goto(`/admin/events/${eventId}/invitations`);
    await expect(page.getByText("Guest access has ended.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export CSV" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create Invitation" }),
    ).toHaveCount(0);
    const endedDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const endedDownload = await endedDownloadPromise;
    const endedCsv = await readFile((await endedDownload.path())!, "utf8");
    expect(endedCsv).toContain("'=Attending Household");
    expect(endedCsv).toContain("Declined Household");
    expect(endedCsv).toContain("Awaiting Household");

    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await page.getByLabel("Email address").fill(stranger.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(stranger.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    const wrongOwner = await page.request.get(path);
    expect(wrongOwner.status()).toBe(404);
    expect(await wrongOwner.text()).not.toContain("Attending Household");
  } finally {
    await cleanupOrganizerAccount(organizer.id);
    await cleanupOrganizerAccount(stranger.id);
  }
});
