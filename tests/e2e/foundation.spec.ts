import { expect, test } from "@playwright/test";

test("E2E-M1 application boots", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Digital Invitation & RSVP Platform" }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveCSS(
    "background-color",
    "rgb(255, 253, 249)",
  );
});
