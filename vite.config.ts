import { execFileSync } from "node:child_process";
import { defineConfig, loadEnv, type Plugin } from "vite";

// The date the site's content last changed: the last commit touching src/ or
// public/, or today if git isn't available (e.g. building from a tarball).
function lastModified(): string {
  try {
    const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", "src", "public"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (date) return date;
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

// Write sitemap.xml and robots.txt into the build, using the site URL from
// .env.production so they always match the canonical and og:url tags.
function seoFiles(siteUrl: string): Plugin {
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
  <url>
    <loc>${site}/</loc>
    <lastmod>${lastModified()}</lastmod>
  </url>
</urlset>
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

export default defineConfig(({ mode }) => {
  // .env files live in the project folder (next to this file), not in src/.
  const { VITE_SITE_URL } = loadEnv(mode, import.meta.dirname, "VITE_");
  if (!VITE_SITE_URL) throw new Error(`VITE_SITE_URL is not set in .env.${mode}`);

  return {
    root: "src",
    publicDir: "../public",
    envDir: "..",
    plugins: [seoFiles(VITE_SITE_URL)],
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    rollupOptions: {
      input: {
        main: "src/index.html",
        notFound: "src/404.html",
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
  };
});
