// Build-time helpers shared by the pages (src/pages/). Not for the browser.
import { existsSync } from "node:fs";
import { join } from "node:path";

if (!import.meta.env.VITE_SITE_URL) throw new Error("VITE_SITE_URL is not set in .env.development or .env.production");

/** The site's address, without a trailing slash, for absolute URLs (canonical, og:url, sitemap). */
export const SITE = import.meta.env.VITE_SITE_URL.replace(/\/$/, "");

// Astro runs the build from the project folder.
const SCREENSHOTS = join(process.cwd(), "src", "assets", "screenshots");

export type View = "desktop" | "mobile";

/** A project's full-size screenshot, saved by `npm run screenshots`. */
export const screenshotFile = (id: string, view: View) => join(SCREENSHOTS, `${id}-${view}.webp`);

export const hasScreenshots = (id: string) =>
  existsSync(screenshotFile(id, "desktop")) && existsSync(screenshotFile(id, "mobile"));

/** A project's link preview image, made from its desktop screenshot (src/pages/img/projects/[id].jpg.ts). */
export const projectOgImage = (id: string) => `/img/projects/${id}.jpg`;
