// sitemap.xml, listing every page but the 404, with absolute URLs from
// VITE_SITE_URL so they match the canonical and og:url tags.
import { execFileSync } from "node:child_process";
import type { APIRoute } from "astro";
import { PROJECTS } from "../data/projects.ts";
import { SITE } from "../lib/site.ts";

// The date a page last changed: the last commit touching its files, or today
// if git isn't available (e.g. building from a tarball).
function lastModified(paths: string[]): string {
  try {
    const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", ...paths], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (date) return date;
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

// Each page, with the files whose changes count as changes to it.
const shared = ["src/layouts", "src/components/Header.astro", "src/components/Footer.astro"];
const PAGES = [
  { path: "/", sources: ["src", "public"] },
  { path: "/privacy/", sources: [...shared, "src/pages/privacy"] },
  ...PROJECTS.map(project => ({
    path: `/projects/${project.id}/`,
    sources: [
      ...shared,
      "src/pages/projects",
      "src/data/projects.ts",
      `src/assets/screenshots/${project.id}-desktop.webp`,
      `src/assets/screenshots/${project.id}-mobile.webp`,
    ],
  })),
];

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(
  page => `  <url>
    <loc>${SITE}${page.path}</loc>
    <lastmod>${lastModified(page.sources)}</lastmod>
  </url>
`,
).join("")}</urlset>
`,
    { headers: { "Content-Type": "application/xml" } },
  );
