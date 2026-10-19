import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { HERO_IMAGE_BUCKET } from "@/modules/hero-image/validation";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

process.loadEnvFile(".env.local");

test("M13 confirms Draft and Ended deletion, hides active deletion, and invalidates former Guest access", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const organizer = await provisionOtpOrganizer();
  const service = serviceClient();
  let draftId: string | null = null;
  try {
    const draft = await service
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        event_title: "Synthetic Draft to Delete",
      })
      .select("id")
      .single();
    if (draft.error || !draft.data) throw draft.error;
    draftId = draft.data.id;
    const heroPath = `${draftId}/${randomUUID()}.png`;
    const uploaded = await service.storage.from(HERO_IMAGE_BUCKET).upload(
      heroPath,
      new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], {
        type: "image/png",
      }),
      { contentType: "image/png" },
    );
    if (uploaded.error) throw uploaded.error;
    const attached = await service.rpc("set_hero_image_reference", {
      p_event_id: draftId,
      p_owner_user_id: organizer.id,
      p_expected_previous_path: null,
      p_storage_path: heroPath,
    });
    if (attached.error) throw attached.error;

    async function createEvent(
      title: string,
      eventDate: string,
      status: "draft" | "published",
    ) {
      const result = await service
        .from("events")
        .insert({
          owner_user_id: organizer.id,
          publication_status: status,
          published_at: status === "published" ? "2020-01-01T00:00:00Z" : null,
          event_type: "wedding",
          event_title: title,
          host_display_names: ["Host"],
          event_date: eventDate,
          start_time: "18:00",
          end_time: "21:00",
          event_timezone: "Asia/Bangkok",
          venue_name: "Venue",
          venue_address: "Address",
        })
        .select("id")
        .single();
      if (result.error || !result.data) throw result.error;
      return result.data.id;
    }
    const endedId = await createEvent(
      "Synthetic Ended to Delete",
      "2000-01-01",
      "draft",
    );
    const activeId = await createEvent(
      "Synthetic Active to Keep",
      "2099-11-29",
      "published",
    );
    const rawToken = randomBytes(32).toString("base64url");
    const hash = createHmac(
      "sha256",
      Buffer.from(process.env.INVITATION_TOKEN_HASH_KEY!, "base64url"),
    )
      .update(rawToken)
      .digest("hex");
    const invitation = await service.rpc("create_invitation_record", {
      p_owner_user_id: organizer.id,
      p_event_id: endedId,
      p_invitee_name: "Former Guest",
      p_maximum_party_size: 2,
      p_token_lookup_hash: `\\x${hash}`,
      p_token_ciphertext: "synthetic-deletion-browser-envelope",
      p_token_key_version: 1,
    });
    if (invitation.error) throw invitation.error;
    const publishedEnded = await service
      .from("events")
      .update({ publication_status: "published" })
      .eq("id", endedId);
    if (publishedEnded.error) throw publishedEnded.error;

    await page.goto("/admin/sign-in");
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });
    await page
      .getByLabel("Six-digit code")
      .fill(await readLatestOtp(organizer.email));
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/events/${draftId}/settings`);
    await page
      .getByRole("button", { name: "Delete Event", exact: true })
      .click();
    const draftDialog = page.getByRole("dialog", {
      name: "Permanently delete this event?",
    });
    await expect(draftDialog).toBeVisible();
    await expect(draftDialog).toContainText("Synthetic Draft to Delete");
    await expect(draftDialog).toContainText("Invitations, current RSVPs");
    await expect(draftDialog).toContainText(
      "Invitation access credentials, and Hero Image",
    );
    await expect(draftDialog).toContainText("This cannot be undone.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await draftDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(draftDialog).toBeHidden();
    await page
      .getByRole("button", { name: "Delete Event", exact: true })
      .click();
    await draftDialog
      .getByRole("button", { name: "Permanently Delete Event" })
      .click();
    await expect(page).toHaveURL(/\/admin\/events$/, { timeout: 15_000 });
    await expect(page.getByText("Synthetic Draft to Delete")).toHaveCount(0);
    expect(
      (await service.storage.from(HERO_IMAGE_BUCKET).info(heroPath)).error,
    ).not.toBeNull();

    await page.goto(`/admin/events/${activeId}/settings`);
    await expect(
      page.getByRole("button", { name: "Delete Event", exact: true }),
    ).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/admin/events/${endedId}/invitations`);
    await expect(page.getByRole("table")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("table")).toBeHidden();
    await expect(
      page.getByRole("listitem").getByText("Former Guest"),
    ).toBeVisible();
    await page.goto(`/admin/events/${endedId}/settings`);
    await expect(
      page
        .getByRole("definition")
        .filter({ hasText: "Synthetic Ended to Delete" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete Event", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete Event", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Permanently delete this event?" })
      .getByRole("button", { name: "Permanently Delete Event" })
      .click();
    await expect(page).toHaveURL(/\/admin\/events$/, { timeout: 15_000 });
    await expect(page.getByText("Synthetic Ended to Delete")).toHaveCount(0);
    const guest = await request.get(`/i/${rawToken}`);
    expect(guest.status()).toBe(200);
    expect(await guest.text()).not.toContain("Former Guest");
    await page.goto(`/i/${rawToken}`);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(page.getByText("Former Guest")).toHaveCount(0);
  } finally {
    if (draftId) {
      const bucket = service.storage.from(HERO_IMAGE_BUCKET);
      const listed = await bucket.list(draftId);
      if (listed.data?.length)
        await bucket.remove(
          listed.data.map((file) => `${draftId}/${file.name}`),
        );
    }
    await cleanupOrganizerAccount(organizer.id);
  }
});
