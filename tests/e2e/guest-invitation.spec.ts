import { createHmac, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  cleanupOrganizerAccount,
  provisionOtpOrganizer,
  serviceClient,
} from "../helpers/local-supabase";

process.loadEnvFile(".env.local");

test("E2E-G-01/11 and M6 privacy headers render one personalized Invitation on a phone", async ({
  page,
  request,
}) => {
  const organizer = await provisionOtpOrganizer();
  try {
    const event = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        publication_status: "published",
        published_at: "2099-11-20T00:00:00Z",
        event_type: "wedding",
        event_title: "Private Synthetic Event",
        host_display_names: ["Alex", "Sam"],
        event_date: "2099-11-29",
        start_time: "18:00",
        end_time: "21:00",
        event_timezone: "Asia/Bangkok",
        venue_name: "Private Venue",
        venue_address: "123 Synthetic Lane",
        invitation_message: "We would love to celebrate with you.",
        dress_code: "Formal",
        venue_arrival_notes: "Enter through the garden.",
        venue_map_url: "https://example.test/map",
        organizer_contact_information: "Ask the hosts for help.",
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
      p_invitee_name: "Guest Household",
      p_maximum_party_size: 3,
      p_token_lookup_hash: `\\x${lookupHash}`,
      p_token_ciphertext: "synthetic-browser-test-envelope",
      p_token_key_version: 1,
    });
    if (invitation.error) throw invitation.error;
    const path = `/i/${rawToken}`;
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    const html = await response.text();
    expect(html.split("</head>")[0]).not.toContain(rawToken);
    expect(html).not.toContain("Private Synthetic Event");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: /Alex and Sam/ }),
    ).toBeVisible();
    await expect(page.getByText("Guest Household")).toBeVisible();
    await expect(page.getByText("Private Venue")).toBeVisible();
    await expect(page.getByText("123 Synthetic Lane")).toBeVisible();
    await expect(
      page.getByText("We would love to celebrate with you."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dress Code" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View on Map" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await page.screenshot({
      path: "test-results/m6-guest-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(await page.locator("body").innerText()).not.toContain(
      "Private Synthetic Event",
    );
    expect(await page.locator("body").innerText()).not.toContain(rawToken);
    const injected = "<script>window.__guestXss = true</script>";
    const contentUpdate = await serviceClient()
      .from("events")
      .update({ invitation_message: injected })
      .eq("id", event.data.id);
    if (contentUpdate.error) throw contentUpdate.error;
    await page.goto(path);
    await expect(page.getByText(injected)).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as Window & { __guestXss?: boolean }).__guestXss,
      ),
    ).toBeUndefined();
    await page.goto("/i/invalid");
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(page.getByText("Private Venue")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    const unknown = randomBytes(32).toString("base64url");
    await page.goto(`/i/${unknown}`);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(page.getByText("Guest Household")).toHaveCount(0);

    const draft = await serviceClient()
      .from("events")
      .insert({
        owner_user_id: organizer.id,
        event_title: "Hidden Draft Event",
      })
      .select("id")
      .single();
    if (draft.error || !draft.data) throw draft.error;
    const draftToken = randomBytes(32).toString("base64url");
    const draftHash = createHmac("sha256", hashKey)
      .update(draftToken)
      .digest("hex");
    const draftInvitation = await serviceClient().rpc(
      "create_invitation_record",
      {
        p_owner_user_id: organizer.id,
        p_event_id: draft.data.id,
        p_invitee_name: "Hidden Draft Household",
        p_maximum_party_size: 2,
        p_token_lookup_hash: `\\x${draftHash}`,
        p_token_ciphertext: "synthetic-draft-envelope",
        p_token_key_version: 1,
      },
    );
    if (draftInvitation.error) throw draftInvitation.error;
    await page.goto(`/i/${draftToken}`);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(page.getByText("Hidden Draft Household")).toHaveCount(0);
    const revoke = await serviceClient()
      .from("invitations")
      .update({ revoked_at: "2099-11-20T00:00:00Z" })
      .eq("id", invitation.data!);
    if (revoke.error) throw revoke.error;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();

    const unrevoke = await serviceClient()
      .from("invitations")
      .update({ revoked_at: null })
      .eq("id", invitation.data!);
    if (unrevoke.error) throw unrevoke.error;
    const expire = await serviceClient()
      .from("events")
      .update({ event_date: "2000-01-01" })
      .eq("id", event.data.id);
    if (expire.error) throw expire.error;
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Invitation unavailable" }),
    ).toBeVisible();
    await expect(page.getByText("Guest Household")).toHaveCount(0);
  } finally {
    await cleanupOrganizerAccount(organizer.id);
  }
});
