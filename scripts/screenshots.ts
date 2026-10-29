// Capture full-page desktop and mobile screenshots of every project in
// src/data/projects.js, saved as src/assets/screenshots/<id>-<view>.webp.
//
// Usage: npm run screenshots                  capture projects with no screenshots yet
//        npm run screenshots -- --all         recapture everything
//        npm run screenshots -- crown-oil      recapture specific project ids
//
// Runs on the host (not in Docker) and drives your installed Google Chrome.
import { mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";
import sharp from "sharp";
import { PROJECTS, type Project } from "../src/data/projects.ts";

const OUT_DIR = fileURLToPath(new URL("../src/assets/screenshots/", import.meta.url));

type View = "desktop" | "mobile";

const VIEWS: Record<View, BrowserContextOptions & { viewport: { width: number; height: number } }> = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
};

// WebP can't encode images taller than this; longer pages are cropped.
const WEBP_MAX_HEIGHT = 16383;

const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = args.filter(arg => !arg.startsWith("--"));

const unknown = ids.filter(id => !PROJECTS.some(p => p.id === id));
if (unknown.length) {
  console.error(`Unknown project id(s): ${unknown.join(", ")}`);
  console.error(`Known ids: ${PROJECTS.map(p => p.id).join(", ")}`);
  process.exit(1);
}

const outPath = (project: Project, view: View) => `${OUT_DIR}${project.id}-${view}.webp`;
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function needsCapture(project: Project) {
  if (all || ids.includes(project.id)) return true;
  if (ids.length) return false;
  const present = await Promise.all((Object.keys(VIEWS) as View[]).map(view => exists(outPath(project, view))));
  return present.includes(false);
}

// Scroll to the bottom in steps so lazy-loaded images and scroll-triggered
// animations fire, then return to the top. Scrolling is instant even on sites
// that set smooth scrolling: fixed headers are drawn at the scroll position
// when the screenshot is taken, so it must be back at the top by then.
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const jump = (top: number) => scrollTo({ top, behavior: "instant" });
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      jump(y);
      await delay(150);
    }
    jump(0);
  });
}

// Hide floating overlays while keeping fixed headers: cookie/consent banners
// (by text, or the extreme z-index consent tools use for them and their
// backdrops) and anything fixed to the lower half of the screen, like chat
// widgets and back-to-top buttons.
async function hideOverlays(page: Page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const style = getComputedStyle(el);
      if (style.position !== "fixed") continue;
      const { top, height } = el.getBoundingClientRect();
      const floating = height > 0 && top > innerHeight / 2;
      if (floating || /\bcookies?\b|\bconsent\b/i.test(el.innerText) || Number(style.zIndex) >= 100_000) {
        el.style.setProperty("display", "none", "important");
      }
    }
    // Undo any scroll lock the banner applied. Only touch the vertical axis:
    // sites often clip horizontal overflow from off-screen elements.
    document.documentElement.style.setProperty("overflow-y", "auto", "important");
    document.body.style.setProperty("overflow-y", "auto", "important");
  });
}

// Pause every video on its final frame, where hero videos usually end on
// their fully composed shot. Pausing before a video ends also stops video
// carousels (which advance on "ended") from moving to the next slide.
async function freezeVideos(page: Page) {
  await page.evaluate(async () => {
    const once = (target: EventTarget, event: string, ms = 5000) =>
      new Promise(resolve => {
        target.addEventListener(event, resolve, { once: true });
        setTimeout(resolve, ms);
      });

    await Promise.all(
      [...document.querySelectorAll("video")].map(async video => {
        video.pause();
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) await once(video, "loadedmetadata");
        if (!Number.isFinite(video.duration)) return;
        video.currentTime = Math.max(video.duration - 0.05, 0);
        await once(video, "seeked");
      }),
    );
  });
}

async function capture(browser: Browser, project: Project, view: View) {
  const context = await browser.newContext({ ...VIEWS[view], reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(`https://${project.url}/`, { waitUntil: "load", timeout: 60_000 });
    await freezeVideos(page);
    await scrollThrough(page);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await hideOverlays(page);
    // Again, for any videos added while scrolling.
    await freezeVideos(page);

    const png = await page.screenshot({ fullPage: true, animations: "disabled" });
    const { width = 0, height = 0 } = await sharp(png).metadata();
    const crop = { width: Math.min(width, VIEWS[view].viewport.width), height: Math.min(height, WEBP_MAX_HEIGHT) };
    if (height > WEBP_MAX_HEIGHT) {
      console.warn(`  ${view}: page is ${height}px tall, cropping to ${WEBP_MAX_HEIGHT}px`);
    }
    // Anything wider than the viewport is overflow the site would normally hide.
    await sharp(png)
      .extract({ left: 0, top: 0, ...crop })
      .webp({ quality: 80 })
      .toFile(outPath(project, view));
  } finally {
    await context.close();
  }
}

const queue: Project[] = [];
for (const project of PROJECTS) {
  if (await needsCapture(project)) queue.push(project);
}

if (!queue.length) {
  console.log("All projects already have screenshots. Use --all or pass ids to recapture.");
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const failed: string[] = [];

for (const project of queue) {
  console.log(`${project.name} (${project.url})`);
  for (const view of Object.keys(VIEWS) as View[]) {
    try {
      await capture(browser, project, view);
      console.log(`  ${view}: saved`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ${view}: failed — ${message.split("\n")[0]}`);
      failed.push(`${project.id} (${view})`);
    }
  }
}

await browser.close();

if (failed.length) {
  console.error(`\nFailed: ${failed.join(", ")}`);
  process.exit(1);
}
