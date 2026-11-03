import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";
import { imagetools } from "vite-imagetools";

// The Content-Security-Policy in public/.htaccess allows inline scripts only
// by hash. After the build, hash every inline script in the built pages (the
// theme script in each <head>) and write the hashes into dist/.htaccess, so
// editing a script can't leave a stale hash that blocks it. (Astro's own
// security.csp writes a <meta> policy instead, which can't set
// frame-ancestors, so the header policy stays.)
const HASHES_PLACEHOLDER = "__INLINE_SCRIPT_HASHES__";

function cspHashes(): AstroIntegration {
  return {
    name: "csp-hashes",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const outDir = fileURLToPath(dir);
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
    },
  };
}

export default defineConfig({
  // /privacy/ is built as privacy/index.html, and so on.
  build: {
    format: "directory",
    // Hashed files go in /assets/, which public/.htaccess caches for a year.
    assets: "assets",
    // The CSP allows stylesheets from this site only, not inline <style>.
    inlineStylesheets: "never",
  },
  devToolbar: { enabled: false },
  integrations: [cspHashes()],
  server: { host: true, port: 5173 },
  vite: {
    // imagetools resizes the project screenshots (see SRCSETS in
    // src/scripts/screenshots.ts).
    plugins: [imagetools()],
    server: { strictPort: true },
    build: {
      // Vite inlines small files into the CSS as data: URIs. The skill logos
      // are only shown on the résumé, so keep them as separate (cached) files
      // rather than adding ~80 KB to the stylesheet that every page waits for.
      assetsInlineLimit: file => (file.includes("/assets/icons/skills/") ? false : undefined),
    },
  },
});
