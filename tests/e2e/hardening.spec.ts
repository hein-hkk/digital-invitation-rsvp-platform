import AxeBuilder from "@axe-core/playwright";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

process.loadEnvFile(".env.local");

async function expectAccessible(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    })),
    state,
  ).toEqual([]);
}

test("M14 security headers and accessible public states", async ({
  page,
  request,
}) => {
  const home = await request.get("/");
  expect(home.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(
    home.headers()["content-security-policy"].split("style-src")[0],
  ).not.toContain("'unsafe-inline'");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["referrer-policy"]).toBe("no-referrer");
  expect(home.headers()["permissions-policy"]).toContain("camera=()");
  expect(home.headers()["strict-transport-security"]).toContain("max-age=");

  const admin = await request.get("/admin/sign-in");
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");

  const guest = await request.get("/i/invalid");
  expect(guest.headers()["cache-control"]).toContain("no-store");
  expect(guest.headers()["x-robots-tag"]).toContain("noindex");
  expect(guest.headers()["referrer-policy"]).toBe("no-referrer");

  await page.goto("/i/invalid");
  await expectAccessible(page, "unavailable invitation");
  await page.goto("/admin/sign-in");
  await expectAccessible(page, "Organizer sign in");
});

test("M14 Guest and Admin states pass accessibility and responsive checks", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const organizer = await provisionOtpOrganizer();
  const service = serviceClient();
  try {
    const event = await service
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: "2026-01-01T00:00:00Z",
        event_type: "wedding",
        event_title: "Accessibility fixture",
        host_display_names: ["Host One", "Host Two"],
        event_date: "2099-11-29",
        start_time: "18:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Synthetic Venue",
        venue_address: "Synthetic Address",
      })
      .select("id")
      .single();
    if (event.error || !event.data) throw event.error;
    const draft = await service
      .from("events")
      .insert({ owner_user_id: organizer.id, event_title: "Draft fixture" })
      .select("id")
      .single();
    if (draft.error || !draft.data) throw draft.error;
    const token = randomBytes(32).toString("base64url");
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.INVITATION_TOKEN_ENCRYPTION_KEY_V1!, "base64url"),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final(),
    ]);
    const ciphertext = `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
    const hash = createHmac(
      "sha256",
      Buffer.from(process.env.INVITATION_TOKEN_HASH_KEY!, "base64url"),
    )
      .update(token)
      .digest("hex");
    const invitation = await service.rpc("create_invitation_record", {
      p_owner_user_id: organizer.id,
      p_event_id: event.data.id,
      p_invitee_name: "Accessible Invitee",
      p_maximum_party_size: 2,
      p_token_lookup_hash: `\\x${hash}`,
      p_token_ciphertext: ciphertext,
      p_token_key_version: 1,
    });
    if (invitation.error || !invitation.data) throw invitation.error;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/i/${token}`);
    await expectAccessible(page, "Guest awaiting response");
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Submit RSVP" }).click();
    await expect(page.getByText("Choose Attending or Declined.")).toBeVisible();
    await expectAccessible(page, "Guest validation error");
    const attending = page.getByRole("radio", { name: "Attending" });
    await attending.focus();
    await attending.press("Space");
    await expect(attending).toBeChecked();
    await page.getByLabel("How many people will attend?").selectOption("1");
    await expectAccessible(page, "Guest attending form");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Submit RSVP" }).click();
    await expect(page.getByText("Your RSVP has been saved.")).toBeVisible();
    await expectAccessible(page, "Guest saved response");
    const deadline = await service
      .from("events")
      .update({ rsvp_deadline_local: "2000-01-01T00:00:00" })
      .eq("id", event.data.id);
    if (deadline.error) throw deadline.error;
    await page.reload();
    await expect(page.getByText("RSVP changes are now closed.")).toBeVisible();
    await expectAccessible(page, "Guest deadline read-only");

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
    await expectAccessible(page, "Admin Events index");
    await page.goto(`/admin/events/${draft.data.id}/settings`);
    await expectAccessible(page, "Admin Event Settings");
    const trigger = page.getByRole("button", {
      name: "Delete Event",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Permanently delete this event?",
    });
    await expectAccessible(page, "Event delete dialog");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/admin/events/${event.data.id}`);
    await expectAccessible(page, "Admin Overview tablet");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto(`/admin/events/${event.data.id}/invitations`);
    await expectAccessible(page, "Admin Invitations tablet");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("table")).toBeHidden();
    await expect(page.getByText("Accessible Invitee").last()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("table")).toBeVisible();
    await expectAccessible(page, "Admin Invitations desktop table");
    await page.goto(
      `/admin/events/${event.data.id}/invitations/${invitation.data}`,
    );
    await expectAccessible(page, "Admin Invitation detail");
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
