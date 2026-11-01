import { test, expect } from "./fixtures.ts";
import { pageStats } from "../src/data/stats.ts";

// The theme toggle, and the standalone pages loading cleanly.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("consent", "denied"));
});

test("the theme follows the system until the visitor picks one", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toHaveAttribute("aria-pressed", "false");

  // The choice now outlasts a reload and a change of system setting.
  await page.reload();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "light");
});

for (const [path, heading] of [
  ["/", "Mark Eriksson_"],
  ["/privacy/", "Privacy and cookies"],
  ["/404.html", "Nothing here_"],
] as const) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // The build writes the stats into the HTML (the page-stats plugin), so
  // they're right before, or without, the page's scripts.
  test("the hero stats and footer year are already in the HTML", async ({ page }) => {
    const stats = pageStats();
    await page.goto("/");
    await expect(page.locator("[data-years]")).toHaveText(String(stats["data-years"]));
    await expect(page.locator("[data-project-total]")).toHaveText(String(stats["data-project-total"]));
    await expect(page.locator("[data-personal-total]")).toHaveText(String(stats["data-personal-total"]));
    await expect(page.locator("[data-year]")).toHaveText(String(stats["data-year"]));
  });
});
