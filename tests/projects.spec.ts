import { existsSync } from "node:fs";
import { test, expect } from "./fixtures.ts";
import { PROJECTS, siteHref } from "../src/data/projects.ts";

// The project gallery: deep links, filters and keyboard navigation.
// See src/scripts/projects.ts.
const personal = PROJECTS.filter(project => project.cat === "Personal");

test.beforeEach(async ({ page }) => {
  // Answer the cookie banner up front so it doesn't sit over the gallery.
  await page.addInitScript(() => localStorage.setItem("consent", "denied"));
});

test("opening the page doesn't rewrite the address", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[0].name);
  expect(new URL(page.url()).hash).toBe("");
});

test("a project link opens that project", async ({ page }) => {
  const project = PROJECTS[3];
  await page.goto(`/#projects/${project.id}`);

  await expect(page.locator("[data-name]")).toHaveText(project.name);
  await expect(page.locator('[data-list] [aria-current="true"]')).toContainText(project.name);
  await expect(page.locator("[data-visit]")).toHaveAttribute("href", siteHref(project)!);
  await expect(page.locator("#projects")).toBeInViewport();
});

test("retired projects are listed last, labelled and linked to their archived copy", async ({ page }) => {
  const firstRetired = PROJECTS.findIndex(project => project.retired);
  expect(firstRetired, "a retired project to test with").toBeGreaterThan(-1);
  expect(PROJECTS.slice(firstRetired).every(project => project.retired)).toBe(true);

  const retired = PROJECTS[firstRetired];
  await page.goto(`/#projects/${retired.id}`);
  await expect(page.locator("[data-retired]")).toBeVisible();
  await expect(page.locator("[data-retired]")).toHaveText("retired");
  await expect(page.locator("[data-json]")).toContainText(`"retired": ${retired.retired!.year}`);
  await expect(page.locator("[data-visit]")).toHaveText("View archived copy");
  await expect(page.locator("[data-visit]")).toHaveAttribute("href", siteHref(retired)!);
  await expect(page.locator("[data-href]")).toHaveAttribute("href", /^https:\/\/web\.archive\.org\/web\//);

  await page.goto(`/#projects/${PROJECTS[0].id}`);
  await expect(page.locator("[data-retired]")).toBeHidden();
  await expect(page.locator("[data-visit]")).toHaveText("Visit site");
});

test("an unknown project link falls back to the first project", async ({ page }) => {
  await page.goto("/#projects/not-a-project");
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[0].name);
});

test("filters narrow the list and update the address", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Personal/ }).click();

  await expect(page.getByRole("button", { name: /^Personal/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-list] li")).toHaveCount(personal.length);
  await expect(page.locator("[data-count]")).toHaveText(`showing ${personal.length} of ${PROJECTS.length}`);
  await expect(page.locator("[data-name]")).toHaveText(personal[0].name);
  await expect(page).toHaveURL(new RegExp(`#projects/${personal[0].id}$`));
});

test("a link to a project outside the current filter switches back to All", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Personal/ }).click();

  await page.evaluate(id => (location.hash = `#projects/${id}`), PROJECTS[0].id);
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[0].name);
  await expect(page.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
});

test("arrow keys step through projects and wrap around", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-list] button").first().focus();

  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[1].name);
  // Focus follows the selection, since the list is rebuilt.
  await expect(page.locator('[data-list] [aria-current="true"]')).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`#projects/${PROJECTS[1].id}$`));

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS.at(-1)!.name);
});

test("the pager buttons step through projects", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Next project" }).click();
  await expect(page.locator("[data-position]")).toHaveText(`2 / ${PROJECTS.length}`);
  await page.getByRole("button", { name: "Previous project" }).click();
  await expect(page.locator("[data-position]")).toHaveText(`1 / ${PROJECTS.length}`);
});

test("every project has both screenshots", async ({ page }) => {
  await page.goto("/");
  for (const [i, project] of PROJECTS.entries()) {
    await expect(page.locator("[data-name]"), `project ${i + 1}`).toHaveText(project.name);
    await expect(page.locator("[data-stage]")).toHaveClass(/\bhas-shots\b/);
    for (const view of ["desktop", "mobile"]) {
      await expect(page.locator(`[data-shot="${view}"]`)).toHaveJSProperty("complete", true);
      expect(
        await page.locator(`[data-shot="${view}"]`).evaluate((img: HTMLImageElement) => img.naturalWidth),
      ).toBeGreaterThan(0);
    }
    await page.getByRole("button", { name: "Next project" }).click();
  }
});

const hasDarkShots = (id: string) =>
  existsSync(new URL(`../src/assets/screenshots/${id}-desktop-dark.webp`, import.meta.url));

test("screenshots follow the site's theme where the project has a dark capture", async ({ page }) => {
  const withDark = PROJECTS.find(project => hasDarkShots(project.id));
  const lightOnly = PROJECTS.find(project => !hasDarkShots(project.id));
  test.skip(!withDark, "no project has dark screenshots");
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto(`/#projects/${withDark!.id}`);
  for (const view of ["desktop", "mobile"]) {
    await expect(page.locator(`[data-shot="${view}"]`)).toHaveAttribute("srcset", new RegExp(`-${view}-dark-`));
  }
  // Switching the site to light swaps them for the light captures.
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  for (const view of ["desktop", "mobile"]) {
    await expect(page.locator(`[data-shot="${view}"]`)).not.toHaveAttribute("srcset", /-dark-/);
  }

  // Projects without a dark mode show their light screenshots in dark mode.
  if (lightOnly) {
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.goto(`/#projects/${lightOnly.id}`);
    await expect(page.locator('[data-shot="desktop"]')).toHaveAttribute("srcset", /\.webp \d+w/);
    await expect(page.locator('[data-shot="desktop"]')).not.toHaveAttribute("srcset", /-dark-/);
  }
});

test("screen readers hear the newly selected project, but not on page load", async ({ page }) => {
  await page.goto("/");
  const announce = page.locator("[data-announce]");
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[0].name);
  await expect(announce).toHaveText("");

  await page.getByRole("button", { name: "Next project" }).click();
  await expect(announce).toHaveText(`${PROJECTS[1].name}, 2 of ${PROJECTS.length}`);
  // The live region replaced the project panel as the thing that's announced.
  await expect(page.locator(".project")).not.toHaveAttribute("aria-live");
});
