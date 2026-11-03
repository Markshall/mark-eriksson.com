import { existsSync } from "node:fs";
import type { Page } from "@playwright/test";
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
  await expect(page.locator("[data-visit]")).toHaveAttribute("href", /^https:\/\/web\.archive\.org\/web\//);

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

  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[1].name);
  // Focus follows the selection, since the tabs are rebuilt.
  await expect(page.locator('[data-list] [aria-current="true"]')).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`#projects/${PROJECTS[1].id}$`));

  await page.keyboard.press("ArrowLeft");
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

test("every project's tab shows its favicon", async ({ page }) => {
  await page.goto("/");
  const icons = page.locator("[data-list] .favicon");
  await expect(icons).toHaveCount(PROJECTS.length);
  for (const icon of await icons.all()) {
    await expect(icon).toHaveJSProperty("complete", true);
    expect(await icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
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

const withVideo = PROJECTS.find(project => project.video);
const videoIn = (page: Page, view: string) => page.locator(`.shot:has([data-shot="${view}"]) video`);

test("a project's videos play over its screenshots", async ({ page }) => {
  test.skip(!withVideo, "no project has a video");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/#projects/${withVideo!.id}`);
  // Each plays once its frame is on screen.
  for (const view of ["desktop", "mobile"]) {
    await videoIn(page, view).scrollIntoViewIfNeeded();
    await expect(videoIn(page, view)).toHaveAttribute("data-playing", "");
  }

  // A project without a video shows just its screenshots.
  const other = PROJECTS.find(project => !project.video)!;
  await page.goto(`/#projects/${other.id}`);
  await expect(page.locator("[data-name]")).toHaveText(other.name);
  await expect(page.locator(".shot video")).toHaveCount(0);
});

test("videos don't play for visitors who prefer reduced motion", async ({ page }) => {
  test.skip(!withVideo, "no project has a video");
  await page.goto(`/#projects/${withVideo!.id}`);
  await expect(page.locator('[data-shot="desktop"]')).toHaveJSProperty("complete", true);
  await expect(page.locator(".shot video")).toHaveCount(0);
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

test("the mouse wheel scrolls a screenshot, then the page once it reaches the end", async ({ page }) => {
  await page.goto("/#projects/" + PROJECTS[0].id);
  const shot = page.locator(".explorer .browser .shot");
  const scrollTop = () => shot.evaluate(el => el.scrollTop);
  await expect(page.locator('[data-shot="desktop"]')).toHaveJSProperty("complete", true);
  await shot.hover();
  const start = await page.evaluate(() => window.scrollY);

  await page.mouse.wheel(0, 200);
  await expect.poll(scrollTop).toBeGreaterThan(0);
  await page.mouse.wheel(0, -2000);
  await expect.poll(scrollTop).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(start);
  await page.mouse.wheel(0, -200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(start);
  await shot.hover();

  // Leaving the frame scrolls it back to the top.
  await page.mouse.wheel(0, 200);
  await expect.poll(scrollTop).toBeGreaterThan(0);
  await page.mouse.move(0, 0);
  await expect.poll(scrollTop).toBe(0);
});

test("dragging the tab strip with a mouse scrolls it without picking a tab", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/");
  const strip = page.locator("[data-list]");
  const scrollLeft = () => strip.evaluate(el => el.scrollLeft);
  expect(await strip.evaluate(el => el.scrollWidth > el.clientWidth), "tabs overflowing the strip").toBe(true);
  await strip.scrollIntoViewIfNeeded();

  const box = (await page.locator("[data-list] li").nth(1).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x - 200, y, { steps: 10 });
  await page.mouse.up();

  await expect.poll(scrollLeft).toBeGreaterThan(0);
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[0].name);

  // A plain click still picks a tab.
  await page.locator("[data-list] li").nth(2).click();
  await expect(page.locator("[data-name]")).toHaveText(PROJECTS[2].name);
});

test("hovering a screenshot scrolls it, unless the visitor prefers reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#projects/" + PROJECTS[0].id);
  const shot = page.locator(".explorer .browser .shot");
  await expect(page.locator('[data-shot="desktop"]')).toHaveJSProperty("complete", true);
  await shot.hover();
  await expect.poll(() => shot.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
});

test("on a touch screen, a tap scrolls a screenshot down and another brings it back up", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("consent", "denied"));
  await page.goto("/#projects/" + PROJECTS[0].id);
  const shot = page.locator(".explorer .browser .shot");
  const scrollTop = () => shot.evaluate(el => el.scrollTop);
  await expect(page.locator('[data-shot="desktop"]')).toHaveJSProperty("complete", true);

  await shot.tap();
  await expect.poll(scrollTop).toBeGreaterThan(0);
  await expect(page.locator(".explorer .browser")).toHaveAttribute("data-scrolled", "");
  await shot.tap();
  await expect.poll(scrollTop).toBe(0);
  await expect(page.locator(".explorer .browser")).not.toHaveAttribute("data-scrolled");
  await context.close();
});
