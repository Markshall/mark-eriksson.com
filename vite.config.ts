import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { imagetools } from "vite-imagetools";
import { pageStats } from "./src/data/stats.ts";
import { PROJECTS } from "./src/data/projects.ts";
import { generatePages, PAGE_SOURCES, projectOgImage, screenshotFile, type GeneratedPage } from "./scripts/pages.ts";

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

// Hand-written pages listed in the sitemap, with the files whose changes count
// as changes to that page. Generated pages (scripts/pages.ts) are added to these.
const PAGES = [
  { path: "/", sources: ["src", "public"] },
  { path: "/privacy/", sources: ["src/privacy"] },
];

// Write sitemap.xml and robots.txt into the build, using the site URL from
// .env.production so they always match the canonical and og:url tags.
function seoFiles(siteUrl: string, generated: GeneratedPage[]): Plugin {
  return {
    name: "seo-files",
    apply: "build",
    generateBundle() {
      const site = siteUrl.replace(/\/$/, "");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...PAGES, ...generated]
  .map(
    page => `  <url>
    <loc>${site}${page.path}</loc>
    <lastmod>${lastModified(page.sources)}</lastmod>
  </url>
`,
  )
  .join("")}</urlset>
`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
    },
  };
}

// Fill the hero stats and footer year into the HTML (see src/data/stats.ts),
// so the page is right before, or without, its JavaScript. Each value goes
// into the element carrying its data attribute, replacing the text there.
function pageStatsPlugin(): Plugin {
  return {
    name: "page-stats",
    transformIndexHtml(html) {
      for (const [attr, value] of Object.entries(pageStats())) {
        html = html.replace(new RegExp(`(<[a-z]+\\b[^>]*\\s${attr}(?=[\\s>])[^>]*>)[^<]*`, "g"), `$1${value}`);
      }
      return html;
    },
  };
}

// The project pages (scripts/pages.ts). The pages themselves are generated
// before the build starts (see defineConfig below); this plugin regenerates
// them in dev when a source changes, and makes each project's social preview
// image.
function generatedPagesPlugin(): Plugin {
  return {
    name: "generated-pages",
    configureServer(server) {
      const sources = PAGE_SOURCES.map(source => join(import.meta.dirname, source));
      server.watcher.add(sources);
      server.watcher.on("all", (_event, file) => {
        if (!sources.some(source => file.startsWith(source))) return;
        generatePages();
        server.ws.send({ type: "full-reload" });
      });
    },
    // A 1200×630 crop of the top of each desktop screenshot, for link previews.
    async generateBundle() {
      for (const project of PROJECTS) {
        const file = screenshotFile(project.id, "desktop");
        if (!existsSync(file)) continue;
        const source = await sharp(file).extract({ left: 0, top: 0, width: 1440, height: 756 }).toBuffer();
        this.emitFile({
          type: "asset",
          fileName: projectOgImage(project.id).slice(1),
          source: await sharp(source).resize(1200, 630).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
        });
      }
    },
  };
}

// The Content-Security-Policy in public/.htaccess allows inline scripts only
// by hash. After the build, hash every inline script in the built pages (the
// theme script in each <head>) and write the hashes into dist/.htaccess, so
// editing a script can't leave a stale hash that blocks it.
const HASHES_PLACEHOLDER = "__INLINE_SCRIPT_HASHES__";

function cspHashes(): Plugin {
  let outDir = "";
  return {
    name: "csp-hashes",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const hashes = new Set<string>();
      const pages = readdirSync(outDir, { recursive: true, encoding: "utf8" }).filter(file => file.endsWith(".html"));
      for (const page of pages) {
        const html = readFileSync(join(outDir, page), "utf8");
        for (const [, attrs = "", body] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
          // External scripts are allowed by host, and data blocks such as
          // JSON-LD never run, so neither needs a hash.
          if (/\ssrc=/.test(attrs) || /\stype="(?!module"|text\/javascript")/.test(attrs) || !body.trim()) continue;
          hashes.add(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
        }
      }

      const file = join(outDir, ".htaccess");
      const htaccess = readFileSync(file, "utf8");
      if (!htaccess.includes(HASHES_PLACEHOLDER)) throw new Error(`${HASHES_PLACEHOLDER} is missing from .htaccess`);
      writeFileSync(file, htaccess.replaceAll(HASHES_PLACEHOLDER, [...hashes].join(" ")));
    },
  };
}

export default defineConfig(({ mode, isPreview }) => {
  // .env files live in the project folder (next to this file), not in src/.
  const { VITE_SITE_URL } = loadEnv(mode, import.meta.dirname, "VITE_");
  if (!VITE_SITE_URL) throw new Error(`VITE_SITE_URL is not set in .env.${mode}`);

  // Write the project pages into src/ before Vite looks for its inputs.
  // `vite preview` only serves dist/, so it leaves them alone.
  const generated = isPreview ? [] : generatePages();

  return {
    root: "src",
    publicDir: "../public",
    envDir: "..",
    // imagetools resizes the project screenshots (see SRCSETS in projects.ts).
    plugins: [imagetools(), seoFiles(VITE_SITE_URL, generated), generatedPagesPlugin(), pageStatsPlugin(), cspHashes()],
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      // Vite inlines small files into the CSS as data: URIs. The skill logos
      // are only shown on the résumé, so keep them as separate (cached) files
      // rather than adding ~80 KB to the stylesheet that every page waits for.
      assetsInlineLimit: file => (file.includes("/assets/icons/skills/") ? false : undefined),
      rollupOptions: {
        input: {
          main: "src/index.html",
          notFound: "src/404.html",
          privacy: "src/privacy/index.html",
          ...Object.fromEntries(generated.map(page => [page.path.slice(1, -1).replaceAll("/", "-"), page.file])),
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
  };
});
