import { test, expect } from "./fixtures.ts";
import { PROJECTS } from "../src/data/projects.ts";

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
  await expect(page.locator("[data-visit]")).toHaveAttribute("href", `https://${project.url}/`);
  await expect(page.locator("#projects")).toBeInViewport();
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
