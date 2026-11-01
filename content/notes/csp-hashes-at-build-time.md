---
title: Hashing inline scripts into a CSP at build time
description: How this site keeps a strict Content-Security-Policy without a nonce, a server-side template or a hash that goes stale.
date: 2026-11-01
draft: true
---

This site is static: Vite builds it into plain files and Apache serves them from behind Cloudflare. I wanted a Content-Security-Policy that only lets scripts run from the site itself and Google Tag Manager. One small inline script got in the way.

## The script that has to be inline

Every page starts with a few lines in the `<head>` that set the light or dark theme before the first paint:

```html
<script>
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem("theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch {}
</script>
```

Moving it to an external file would add a render-blocking request just to avoid a flash of the wrong theme, which defeats the point of it.

## Nonce or hash?

A nonce has to be different on every response, so something on the server has to generate it and write it into both the HTML and the header. A static site has nothing to do that.

A hash only depends on the script's text, so a static site can use it. The catch is that the hash breaks the moment anyone edits the script, or even its indentation, and you don't find out until the browser refuses to run it.

## Letting the build write the hash

The CSP lives in `.htaccess` with a placeholder where the hashes go:

```apache
Header always set Content-Security-Policy "script-src 'self' __INLINE_SCRIPT_HASHES__ https://*.googletagmanager.com; ..."
```

A small Vite plugin runs after the build. It reads every built HTML page, finds the inline scripts that actually run (skipping `src=` scripts and JSON-LD data blocks), hashes each one with SHA-256, and writes the list into `dist/.htaccess`. If the placeholder is missing, the build fails rather than shipping a policy that blocks the theme script.

The hash now comes from the exact bytes being deployed, so it can't go stale.

## Checking it

I served the built site from Apache 2.4 in Docker with the real `.htaccess`, then loaded it in Chrome and accepted cookies so Tag Manager and Analytics ran. The only thing the policy blocked was a Google Signals beacon sent to the visitor's own country's Google domain, which is why `img-src` allows any HTTPS host.
