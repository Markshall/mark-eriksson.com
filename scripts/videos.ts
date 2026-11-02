// Record the first few seconds of a project's homepage loading, for sites
// whose hero animates on page load (projects with `video` set in
// src/data/projects.ts). Each view is saved as src/assets/videos/<id>-<view>.mp4
// (H.264, which every browser plays with hardware decoding) and played over
// the top of the screenshots (src/scripts/screenshots.ts).
//
// Usage: npm run videos                  record projects with `video` set and no videos yet
//        npm run videos -- --all         re-record all of them
//        npm run videos -- <id>...       re-record specific project ids
//
// Runs on the host (not in Docker), drives your installed Google Chrome, and
// needs ffmpeg built with libx264 (Homebrew's is).
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";
import sharp from "sharp";
import { PROJECTS, type Project } from "../src/data/projects.ts";

const OUT_DIR = fileURLToPath(new URL("../src/assets/videos/", import.meta.url));

type View = "desktop" | "mobile";

// The same viewports as the screenshots, so a video lines up with the top of
// its screenshot.
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

const FPS = 30;

// How long to wait after the warm-up load for cookie banners and other
// overlays to appear, in milliseconds.
const OVERLAY_WAIT = 3000;

// H.264 High profile, level 4.0, which both viewports fit within. faststart
// puts the index at the front of the file, so it can play while downloading.
const CODEC = [
  ...["-c:v", "libx264", "-preset", "veryslow", "-crf", "26"],
  ...["-profile:v", "high", "-level:v", "4.0", "-movflags", "+faststart"],
];

const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = args.filter(arg => !arg.startsWith("--"));

const unknown = ids.filter(id => !PROJECTS.some(p => p.id === id));
if (unknown.length) {
  console.error(`Unknown project id(s): ${unknown.join(", ")}`);
  console.error(`Known ids: ${PROJECTS.map(p => p.id).join(", ")}`);
  process.exit(1);
}

const outPath = (project: Project, view: View) => `${OUT_DIR}${project.id}-${view}.mp4`;
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function needsVideo(project: Project) {
  if (!project.video || project.retired) {
    if (ids.includes(project.id)) {
      console.warn(`${project.name} ${project.retired ? "is retired" : "has no \`video\` set"}, so it isn't recorded`);
    }
    return false;
  }
  if (all || ids.includes(project.id)) return true;
  if (ids.length) return false;
  const present = await Promise.all((Object.keys(VIEWS) as View[]).map(view => exists(outPath(project, view))));
  return present.includes(false);
}

// Selectors for the floating overlays the screenshot script hides: cookie and
// consent banners (by text, or the extreme z-index consent tools use for them
// and their backdrops) and anything fixed to the lower half of the screen,
// like chat widgets. They're found on a page that has finished loading, then
// hidden by stylesheet in the recorded load, so they never appear in it.
async function overlaySelectors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selectors = new Set<string>();
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const style = getComputedStyle(el);
      if (style.position !== "fixed") continue;
      const { top, height } = el.getBoundingClientRect();
      const floating = height > 0 && top > innerHeight / 2;
      if (!floating && !/\bcookies?\b|\bconsent\b/i.test(el.innerText) && Number(style.zIndex) < 100_000) continue;
      // Without an id or class there's nothing to target it by that wouldn't
      // also hide the rest of the page.
      if (el.id) selectors.add(`#${CSS.escape(el.id)}`);
      else if (el.classList.length) selectors.add([...el.classList].map(name => `.${CSS.escape(name)}`).join(""));
    }
    return [...selectors];
  });
}

// Google ad slots don't fill in an automated browser, as in the screenshots.
const AD_SELECTORS = ["ins.adsbygoogle", ".google-auto-placed"];

interface Frame {
  /** Seconds since the epoch. */
  time: number;
  png: Buffer;
}

// Pages often paint once before their scripts set up the hero, then jump:
// an animated scene empties so it can build up, or a carousel lays itself
// out. Animation moves the page a little each frame; set-up changes a lot of
// it at once. So within the first SETUP_WINDOW seconds, a frame that differs
// from the one before by more than SETUP_JUMP (the mean per-pixel difference,
// 0–255) counts as set-up, and the video starts at the last one.
const SETUP_WINDOW = 1;
const SETUP_JUMP = 5;

const thumbnail = (png: Buffer) => sharp(png).resize(120, 120, { fit: "fill" }).greyscale().raw().toBuffer();

/** When the page's set-up finishes: the time of its last jump, or of the first frame if it doesn't jump. */
async function setupEnd(frames: Frame[]): Promise<number> {
  let start = frames[0].time;
  let previous = await thumbnail(frames[0].png);
  for (const frame of frames.slice(1)) {
    if (frame.time > frames[0].time + SETUP_WINDOW) break;
    const current = await thumbnail(frame.png);
    let total = 0;
    for (let i = 0; i < current.length; i++) total += Math.abs(current[i] - previous[i]);
    if (total / current.length > SETUP_JUMP) start = frame.time;
    previous = current;
  }
  return start;
}

// Record the page loading, from its first contentful paint (less any set-up)
// until `seconds` later.
async function record(
  browser: Browser,
  view: View,
  url: string,
  seconds: number,
): Promise<{ frames: Frame[]; skipped: number }> {
  const { viewport } = VIEWS[view];
  const context = await browser.newContext({ ...VIEWS[view], colorScheme: "light", reducedMotion: "no-preference" });
  try {
    // Load the page once first, so the recorded load comes from the cache:
    // web fonts and images are there from the first paint instead of popping
    // in partway through. This load also finds the overlays to hide.
    const warmup = await context.newPage();
    await warmup.goto(url, { waitUntil: "load", timeout: 60_000 });
    await warmup.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await warmup.waitForTimeout(OVERLAY_WAIT);
    const hidden = [...(await overlaySelectors(warmup)), ...AD_SELECTORS];
    await warmup.close();

    await context.addInitScript(
      css => {
        // An adopted stylesheet applies from the start of the document,
        // before any of the page's own markup or scripts.
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

        // Hero videos start on their own first frame, rather than showing
        // their poster (often the finished scene) and then jumping to it.
        // Mutation observers run before the browser next paints, so no
        // poster is ever drawn.
        new MutationObserver(() => {
          for (const video of document.querySelectorAll("video[poster]")) video.removeAttribute("poster");
        }).observe(document, { childList: true, subtree: true, attributeFilter: ["poster"] });
      },
      `${hidden.join(", ")} { display: none !important; }`,
    );

    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const frames: Frame[] = [];
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      if (metadata.timestamp !== undefined) frames.push({ time: metadata.timestamp, png: Buffer.from(data, "base64") });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "png", maxWidth: viewport.width, maxHeight: viewport.height });

    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    const firstPaint = await page.evaluate(
      () =>
        new Promise<number>(resolve => {
          new PerformanceObserver((list, observer) => {
            const entry = list.getEntriesByName("first-contentful-paint")[0];
            if (!entry) return;
            observer.disconnect();
            resolve(performance.timeOrigin + entry.startTime);
          }).observe({ type: "paint", buffered: true });
        }),
    );
    // Allow for the set-up being skipped, and a little over, so there's a
    // frame to hold until the end.
    await page.waitForTimeout(Math.max(firstPaint + (SETUP_WINDOW + seconds) * 1000 + 500 - Date.now(), 0));
    await cdp.send("Page.stopScreencast");

    const painted = frames.filter(frame => frame.time >= firstPaint / 1000);
    if (!painted.length) throw new Error("no frames were recorded after the first paint");
    for (const frame of painted) {
      const { width, height } = await sizeOf(frame.png);
      if (width !== viewport.width || height !== viewport.height) {
        throw new Error(`a frame was ${width}×${height}, not the ${viewport.width}×${viewport.height} viewport`);
      }
    }
    const start = await setupEnd(painted);
    return {
      frames: painted.filter(frame => frame.time >= start && frame.time < start + seconds),
      skipped: start - painted[0].time,
    };
  } finally {
    await context.close();
  }
}

// A PNG's dimensions, from its IHDR chunk.
async function sizeOf(png: Buffer) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const run = promisify(execFile);

// Encode the frames, which arrive whenever the page repaints rather than at a
// steady rate, into a constant-frame-rate video of exactly `seconds`. Each
// frame is shown until the next one arrived; the last is held to the end.
async function encode(frames: Frame[], seconds: number, output: string) {
  const dir = await mkdtemp(join(tmpdir(), "videos-"));
  try {
    const list: string[] = [];
    for (const [i, frame] of frames.entries()) {
      await writeFile(join(dir, `${i}.png`), frame.png);
      const until = frames[i + 1]?.time ?? frames[0].time + seconds;
      list.push(`file '${i}.png'`, `duration ${(until - frame.time).toFixed(4)}`);
    }
    // The concat demuxer only uses the last frame's duration if it's listed again.
    list.push(`file '${frames.length - 1}.png'`);
    await writeFile(join(dir, "frames.txt"), list.join("\n"));

    // Tag the colours as BT.709 and convert with that matrix, so browsers
    // show the same colours as the screenshot underneath.
    const temp = join(dir, "out.mp4");
    await run("ffmpeg", [
      ...["-hide_banner", "-loglevel", "error", "-y"],
      ...["-f", "concat", "-safe", "0", "-i", join(dir, "frames.txt")],
      ...["-vf", `fps=${FPS},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`],
      ...["-t", String(seconds), "-an"],
      ...["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"],
      ...CODEC,
      temp,
    ]);
    // Written in place only once encoded, so a failure leaves the old video.
    await copyFile(temp, output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const queue: Project[] = [];
for (const project of PROJECTS) {
  if (await needsVideo(project)) queue.push(project);
}

if (!queue.length) {
  console.log("Every project with `video` set already has its videos. Use --all or pass ids to re-record.");
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const failed: string[] = [];

for (const project of queue) {
  const url = `https://${project.url}/`;
  const { seconds } = project.video!;
  console.log(`${project.name} (${url})`);
  for (const view of Object.keys(VIEWS) as View[]) {
    try {
      const { frames, skipped } = await record(browser, view, url, seconds);
      await encode(frames, seconds, outPath(project, view));
      const setup = skipped ? `, skipping ${Math.round(skipped * 1000)}ms of set-up` : "";
      console.log(`  ${view}: saved ${seconds}s from ${frames.length} frames${setup}`);
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
