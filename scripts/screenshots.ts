// Capture full-page desktop and mobile screenshots of every project in
// src/data/projects.js, saved as src/assets/screenshots/<id>-<view>.webp.
// Each view is also captured with the browser set to dark mode, and saved as
// <id>-<view>-dark.webp if the site looks different in it; sites without a
// dark mode only get the light screenshot.
//
// Usage: npm run screenshots                  capture projects with no screenshots yet
//        npm run screenshots -- --all         recapture everything
//        npm run screenshots -- crown-oil      recapture specific project ids
//
// Runs on the host (not in Docker) and drives your installed Google Chrome.
// Retired projects are captured from their Wayback Machine snapshot.
import { mkdir, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";
import sharp from "sharp";
import { PROJECTS, type Project } from "../src/data/projects.ts";

const OUT_DIR = fileURLToPath(new URL("../src/assets/screenshots/", import.meta.url));

type View = "desktop" | "mobile";
type Scheme = "light" | "dark";

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

// How different, on average, the dark capture's pixels must be from the
// light one's (0–255) for the site to count as having a dark mode. Captures of
// the same page differ a little anyway, from carousels and other changing
// content; a dark mode changes far more than this.
const DARK_MODE_THRESHOLD = 20;

const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = args.filter(arg => !arg.startsWith("--"));

const unknown = ids.filter(id => !PROJECTS.some(p => p.id === id));
if (unknown.length) {
  console.error(`Unknown project id(s): ${unknown.join(", ")}`);
  console.error(`Known ids: ${PROJECTS.map(p => p.id).join(", ")}`);
  process.exit(1);
}

// A retired project's snapshot, with Wayback's "if_" flag so the page is
// served without the archive's toolbar. Retired projects without a snapshot
// can't be captured.
function captureUrl(project: Project): string | undefined {
  if (!project.retired) return `https://${project.url}/`;
  const { snapshot } = project.retired;
  return snapshot && `https://web.archive.org/web/${snapshot}if_/https://${project.url}/`;
}

const outPath = (project: Project, view: View, scheme: Scheme = "light") =>
  `${OUT_DIR}${project.id}-${view}${scheme === "dark" ? "-dark" : ""}.webp`;
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function needsCapture(project: Project) {
  if (!captureUrl(project)) {
    if (ids.includes(project.id)) console.warn(`${project.name} is retired with no snapshot, so it can't be captured`);
    return false;
  }
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

// Remove Google ad slots, including the ones AdSense auto ads inject into the
// page. They don't fill in an automated browser, so they'd be captured as
// empty blocks that push the content apart.
async function hideAds(page: Page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("ins.adsbygoogle, .google-auto-placed")) {
      el.style.setProperty("display", "none", "important");
    }
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

// Capture the page as a PNG, cropped to what will be saved.
async function capture(browser: Browser, project: Project, view: View, scheme: Scheme, url: string) {
  const context = await browser.newContext({ ...VIEWS[view], reducedMotion: "reduce", colorScheme: scheme });
  const page = await context.newPage();
  try {
    // The Wayback Machine is much slower than a live site.
    await page.goto(url, { waitUntil: "load", timeout: project.retired ? 180_000 : 60_000 });
    await freezeVideos(page);
    await scrollThrough(page);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await hideOverlays(page);
    await hideAds(page);
    // Again, for any videos added while scrolling.
    await freezeVideos(page);

    const png = await page.screenshot({ fullPage: true, animations: "disabled" });
    const { width = 0, height = 0 } = await sharp(png).metadata();
    const crop = { width: Math.min(width, VIEWS[view].viewport.width), height: Math.min(height, WEBP_MAX_HEIGHT) };
    if (height > WEBP_MAX_HEIGHT) {
      console.warn(`  ${view} (${scheme}): page is ${height}px tall, cropping to ${WEBP_MAX_HEIGHT}px`);
    }
    // Anything wider than the viewport is overflow the site would normally hide.
    return await sharp(png)
      .extract({ left: 0, top: 0, ...crop })
      .png()
      .toBuffer();
  } finally {
    await context.close();
  }
}

// Mean per-pixel difference (0–255) between two captures, compared as small
// greyscale thumbnails so captures of slightly different heights still line up.
async function difference(a: Buffer, b: Buffer) {
  const thumbnail = (png: Buffer) => sharp(png).resize(64, 64, { fit: "fill" }).greyscale().raw().toBuffer();
  const [x, y] = await Promise.all([thumbnail(a), thumbnail(b)]);
  let total = 0;
  for (let i = 0; i < x.length; i++) total += Math.abs(x[i] - y[i]);
  return total / x.length;
}

const save = (png: Buffer, path: string) => sharp(png).webp({ quality: 80 }).toFile(path);

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
  const url = captureUrl(project)!;
  console.log(`${project.name} (${url})`);
  for (const view of Object.keys(VIEWS) as View[]) {
    try {
      // Capture both before saving either, so a failure leaves the existing
      // pair untouched rather than a new light screenshot beside an old dark one.
      const light = await capture(browser, project, view, "light", url);
      const dark = await capture(browser, project, view, "dark", url);
      const diff = await difference(light, dark);
      await save(light, outPath(project, view));
      if (diff > DARK_MODE_THRESHOLD) {
        await save(dark, outPath(project, view, "dark"));
        console.log(`  ${view}: saved light and dark (difference ${diff.toFixed(1)})`);
      } else {
        await rm(outPath(project, view, "dark"), { force: true });
        console.log(`  ${view}: saved, no dark mode (difference ${diff.toFixed(1)})`);
      }
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
