import { test, expect } from "./fixtures.ts";

// Google Tag Manager must only load after the visitor accepts cookies
// (UK GDPR / PECR). See src/scripts/consent.ts.
const banner = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Cookies" });

test("nothing loads from Google until the visitor accepts", async ({ page, gtmRequests }) => {
  await page.goto("/");
  await expect(banner(page)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(gtmRequests).toEqual([]);

  await banner(page).getByRole("button", { name: "Accept" }).click();
  await expect(banner(page)).toBeHidden();
  await expect.poll(() => gtmRequests.length).toBeGreaterThan(0);
  expect(gtmRequests[0]).toContain("gtm.js?id=GTM-");
});

test("rejecting is remembered and never loads Google", async ({ page, gtmRequests }) => {
  await page.goto("/");
  await banner(page).getByRole("button", { name: "Reject" }).click();
  await expect(banner(page)).toBeHidden();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(banner(page)).toBeHidden();
  expect(gtmRequests).toEqual([]);
});

test("accepting is remembered, and cookie settings reopens the banner", async ({ page, gtmRequests }) => {
  await page.goto("/");
  await banner(page).getByRole("button", { name: "Accept" }).click();

  await page.reload();
  await expect(banner(page)).toBeHidden();
  await expect.poll(() => gtmRequests.filter(url => url.includes("gtm.js")).length).toBe(2);

  await page.getByRole("button", { name: "cookie settings" }).click();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Reject" })).toBeFocused();
});
