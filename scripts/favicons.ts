// Save each project's favicon, for its tab in the gallery, as
// src/assets/favicons/<id>.webp (48px square, so it's sharp at 16px on screens
// up to 3x, and small: the homepage has an image budget, lighthouserc.json).
//
// Usage: npm run favicons                  save favicons for projects without one yet
//        npm run favicons -- --all         save them all again
//        npm run favicons -- crown-oil      save specific project ids again
//
// Runs on the host (not in Docker) and drives your installed Google Chrome.
// The icon is drawn by Chrome itself rather than converted, so every format a
// site might use works, ICO included. Retired projects' icons come from their
// Wayback Machine snapshot. Projects whose `favicon` names another project
// use that one's instead, and don't get their own.
import { access, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";
import sharp from "sharp";
import { PROJECTS, type Project } from "../src/data/projects.ts";

const OUT_DIR = fileURLToPath(new URL("../src/assets/favicons/", import.meta.url));
const SIZE = 48;

const args = process.argv.slice(2);
const all = args.includes("--all");
const ids = args.filter(arg => !arg.startsWith("--"));

const unknown = ids.filter(id => !PROJECTS.some(p => p.id === id));
if (unknown.length) {
  console.error(`Unknown project id(s): ${unknown.join(", ")}`);
  console.error(`Known ids: ${PROJECTS.map(p => p.id).join(", ")}`);
  process.exit(1);
}

// The site's homepage, or a retired project's snapshot of it, with Wayback's
// "if_" flag so the page is served without the archive's toolbar.
function pageUrl(project: Project): string | undefined {
  if (!project.retired) return `https://${project.url}/`;
  const { snapshot } = project.retired;
  return snapshot && `https://web.archive.org/web/${snapshot}if_/https://${project.url}/`;
}

// /favicon.ico, where browsers look when a page doesn't link an icon. For a
// snapshot, the archive's copy from around the same time ("im_" serves the
// raw image).
function fallbackIcon(project: Project): string {
  const path = `${project.url.split("/")[0]}/favicon.ico`;
  return project.retired
    ? `https://web.archive.org/web/${project.retired.snapshot}im_/https://${path}`
    : `https://${path}`;
}

const outPath = (project: Project) => `${OUT_DIR}${project.id}.webp`;
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function needsFavicon(project: Project) {
  // It uses another project's favicon instead.
  if (project.favicon) {
    if (ids.includes(project.id)) console.warn(`${project.name} uses ${project.favicon}'s favicon, so it isn't saved`);
    return false;
  }
  if (!pageUrl(project)) {
    if (ids.includes(project.id)) console.warn(`${project.name} is retired with no snapshot, so it has no favicon`);
    return false;
  }
  if (all || ids.includes(project.id)) return true;
  if (ids.length) return false;
  return !(await exists(outPath(project)));
}

/**
 * The page's icons, best first: SVGs, then the largest declared size (icons
 * with no size, often a multi-size ICO, after any of 32px or more), then
 * Apple touch icons (usually an opaque square, so a last resort), then
 * /favicon.ico.
 */
async function iconCandidates(browser: Browser, project: Project, url: string): Promise<string[]> {
  const page = await browser.newPage();
  try {
    // The Wayback Machine is much slower than a live site.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: project.retired ? 180_000 : 60_000 });
    const links = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel~="apple-touch-icon"]')].map(link => ({
        href: link.href,
        touch: /apple-touch-icon/.test(link.rel),
        svg: link.type === "image/svg+xml" || /\.svg(\?|$)/.test(link.href),
        size: link.sizes.contains("any")
          ? Infinity
          : Math.max(0, ...[...link.sizes].map(size => Number.parseInt(size, 10) || 0)),
      })),
    );
    const rank = (icon: (typeof links)[number]) =>
      icon.touch ? 0 : icon.svg ? 4 : icon.size >= 32 ? 3 : icon.size === 0 ? 2 : 1;
    links.sort((a, b) => rank(b) - rank(a) || b.size - a.size);
    return [...new Set([...links.map(icon => icon.href), fallbackIcon(project)])];
  } finally {
    await page.close();
  }
}

/** Draw the icon at SIZE px on a transparent background, or undefined if it doesn't load. */
async function render(browser: Browser, href: string): Promise<Buffer | undefined> {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  try {
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}img{display:block;width:${SIZE}px;height:${SIZE}px;object-fit:contain}</style><img>`,
    );
    const loaded = await page.evaluate(
      src =>
        new Promise<boolean>(resolve => {
          const img = document.querySelector("img")!;
          img.onload = () => resolve(img.naturalWidth > 0);
          img.onerror = () => resolve(false);
          img.src = src;
        }),
      href,
    );
    if (!loaded) return undefined;
    return await page.locator("img").screenshot({ omitBackground: true });
  } finally {
    await page.close();
  }
}

// Remove the saved favicons of projects that now use another's.
for (const project of PROJECTS) {
  if (project.favicon) await rm(outPath(project), { force: true });
}

const queue: Project[] = [];
for (const project of PROJECTS) {
  if (await needsFavicon(project)) queue.push(project);
}

if (!queue.length) {
  console.log("All projects already have favicons. Use --all or pass ids to save them again.");
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const failed: string[] = [];

for (const project of queue) {
  const url = pageUrl(project)!;
  console.log(`${project.name} (${url})`);
  try {
    let saved = false;
    for (const href of await iconCandidates(browser, project, url)) {
      const png = await render(browser, href);
      if (!png) continue;
      await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toFile(outPath(project));
      console.log(`  saved from ${href}`);
      saved = true;
      break;
    }
    if (!saved) throw new Error("no icon loaded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  failed — ${message.split("\n")[0]}`);
    failed.push(project.id);
  }
}

await browser.close();

if (failed.length) {
  console.error(`\nFailed: ${failed.join(", ")}`);
  process.exit(1);
}
