import { expect, test } from "@playwright/test";
import {
  provisionOtpOrganizer,
  readLatestOtp,
  serviceClient,
} from "../helpers/local-supabase";

test("AUTH-05/06 and E2E-A-01 provisioned Organizer signs in, reaches Events, and signs out", async ({
  page,
}) => {
  const organizer = await provisionOtpOrganizer();
  try {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(
      page.getByRole("heading", { name: "Organizer sign in" }),
    ).toBeVisible();
    await page.getByLabel("Email address").fill(organizer.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    const code = await readLatestOtp(organizer.email);
    await page.getByLabel("Six-digit code").fill(code);
    await page.getByRole("button", { name: "Verify code" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Your Events" }),
    ).toBeVisible();
    const sessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "organizer-auth-session",
    );
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    const expiredSession = JSON.parse(
      decodeURIComponent(sessionCookie!.value),
    ) as {
      expires_at: number;
      expires_in: number;
    };
    expiredSession.expires_at = Math.floor(Date.now() / 1000) - 120;
    expiredSession.expires_in = 0;
    await page.context().addCookies([
      {
        name: sessionCookie!.name,
        value: encodeURIComponent(JSON.stringify(expiredSession)),
        domain: sessionCookie!.domain,
        path: sessionCookie!.path,
        httpOnly: true,
        secure: sessionCookie!.secure,
        sameSite: "Lax",
      },
    ]);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Your Events" }),
    ).toBeVisible();
    const refreshedCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === "organizer-auth-session",
    );
    const refreshedSession = JSON.parse(
      decodeURIComponent(refreshedCookie!.value),
    ) as { expires_at: number };
    expect(refreshedSession.expires_at).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "organizer-auth-session",
      ),
    ).toBe(false);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    const signup = await page.request.get("/admin/sign-up");
    expect(signup.status()).toBe(404);
  } finally {
    await serviceClient().auth.admin.deleteUser(organizer.id);
  }
});
