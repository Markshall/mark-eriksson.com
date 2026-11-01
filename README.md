# mark-eriksson.com

Source for **[mark-eriksson.com](https://www.mark-eriksson.com)**, the portfolio and CV of Mark Eriksson, a full-stack developer.

It's a single static page with a light/dark theme, a filterable project gallery with desktop and mobile screenshots of each site, and an experience timeline. There's no framework: just HTML, CSS and TypeScript, built with [Vite](https://vite.dev).

## Quick start

```shell
docker compose up
```

That starts the Vite dev server with hot reload at http://localhost:5173. Dependencies are installed inside the container and reinstalled automatically when `package-lock.json` changes.

If you'd rather run it without Docker, use Node 24+:

```shell
npm install
npm run dev
```

## Project layout

```
src/
  index.html         The page
  styles/            CSS
  scripts/           TypeScript: theme toggle, project gallery, page behaviour
  data/projects.ts   The list of projects, shared by the site and the screenshot script
  assets/            Images processed and hashed by Vite, including project screenshots
public/              Copied as-is to the site root (favicons, og-image, ads.txt, .htaccess)
scripts/             Screenshot capture and deploy scripts
dist/                Build output, which is what goes on the server (git-ignored)
```

## Scripts

| Command                | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Start the dev server                        |
| `npm run typecheck`    | Check TypeScript types                      |
| `npm run format`       | Format all files with Prettier              |
| `npm run format:check` | Check formatting without changing files     |
| `npm run build`        | Type-check, then build to `dist/`           |
| `npm run preview`      | Serve `dist/` locally                       |
| `npm run lighthouse`   | Build, then audit the pages with Lighthouse |
| `npm run screenshots`  | Capture project screenshots (see below)     |
| `npm run deploy`       | Build and upload to the server (see below)  |

Absolute URLs in `src/index.html` (`og:url`, `og:image`) use `%VITE_SITE_URL%`, which is set in `.env.development` (localhost) and `.env.production` (the live domain).

## Adding a project

Projects are listed in `src/data/projects.ts`. Each one gets a full-page desktop (1440px) and mobile (390px) screenshot, saved as `src/assets/screenshots/<id>-desktop.webp` and `<id>-mobile.webp`. Only these full-size captures are committed: at build time, [vite-imagetools](https://github.com/JonasKruckenberg/imagetools) resizes them into smaller copies (`SRCSETS` in `src/scripts/projects.ts`) and the browser picks the one that fits the screen.

Add the project to `src/data/projects.ts`, then capture its screenshots:

```shell
npm run screenshots                  # capture projects with no screenshots yet
npm run screenshots -- crown-oil     # recapture specific project ids
npm run screenshots -- --all         # recapture everything
```

This runs on your machine rather than in Docker and drives your installed Google Chrome. Cookie banners, chat widgets and other floating overlays are hidden before each capture.

A few things to know when a capture goes wrong:

- If a site is down or times out (60s to load), that view is skipped, the rest carry on, and the script exits non-zero listing what failed. Any existing screenshot for the failed view is left untouched, so re-run with just those ids.
- Pages taller than 16,383px (WebP's limit) are cropped at that height, with a warning.
- Videos are frozen on their last frame and the page is scrolled through first so lazy-loaded images appear. If a site still looks wrong, check it in Chrome with reduced motion turned on, because that's how it's captured.

## Editing the page

Only the project gallery is generated from data. Everything else is plain HTML in `src/index.html`:

| Section                     | Where                                                   |
| --------------------------- | ------------------------------------------------------- |
| Hero intro and buttons      | `<section class="hero">`                                |
| Experience, skills chips    | `<section id="resume">`, one `.job-head` block per role |
| Contact email, social links | `<footer id="contact">`                                 |
| Page title, description, OG | `<head>`                                                |

The hero stats fill themselves in from `src/scripts/main.ts`: years since `CAREER_START`, the number of projects, and the number with category `Personal`. The footer year is also set there. The numbers written in the HTML are only fallbacks.

Each project has a shareable link, `/#projects/<id>`, using the `id` from `src/data/projects.ts`. Opening one selects that project and scrolls to the gallery. As visitors browse, the address bar updates to match without adding history entries. In the gallery, the left and right arrow keys step through projects, and up and down do the same while focus is in the list.

`src/privacy/index.html` is the privacy and cookies page, served at `/privacy/` and linked from the footer and the cookie banner. It lists the Google Analytics cookies, so update it if the GTM container starts running other tags. The 404 and privacy pages share `src/scripts/page.ts` and the site's stylesheet.

`src/404.html` is the not-found page, built as a second Vite entry. `public/.htaccess` tells Apache to serve it for missing URLs (`ErrorDocument 404 /404.html`), which needs `AllowOverride` to include `FileInfo` for the web root.

## Theming

Colours are CSS custom properties in `src/styles/tokens.css`. Each theme colour is written once as `light-dark(<light>, <dark>)`, so change both values in the same place. The projects band is dark in both themes and has its own `--band-*` tokens.

By default the page follows the system light/dark setting. The toggle (`src/scripts/theme.ts`) sets `data-theme` on `<html>`, which overrides `color-scheme`, and remembers the choice in `localStorage`. Until a visitor clicks the toggle, the page keeps following system changes.

## SEO and static files

`sitemap.xml` and `robots.txt` are generated at build time by the `seo-files` plugin in `vite.config.ts`, using `VITE_SITE_URL`:

- `sitemap.xml` lists the pages in `PAGES` in `vite.config.ts`. Each `<lastmod>` is the date of the last commit that touched that page's files (or today, if git isn't available).
- `robots.txt` allows everything and points to the sitemap.

`src/index.html` also has a `<link rel="canonical">` and a JSON-LD `Person` block (name, job title, employer, skills, GitHub and CodePen profiles). Update the JSON-LD when the résumé changes.

The rest is updated by hand:

- `public/ads.txt` declares the Google AdSense publisher ID. Keep it if AdSense is in use on the domain.
- `public/img/og-image.png` (1200×630) is the link preview image. Replace it in place if the design changes.
- Google Tag Manager (`GTM-PV3S2MV`) only loads after the visitor accepts cookies, as UK GDPR and PECR require. `src/scripts/consent.ts` sets Google Consent Mode to denied, adds the cookie banner (its text is in that file) until the visitor chooses, and remembers the choice in `localStorage`. "Cookie settings" in the footer reopens the banner. Rejecting after accepting switches Consent Mode back to denied and deletes Google's `_ga`/`_gcl` cookies. There's no `<noscript>` fallback, because it would load GTM without asking.

## Deploying

Pull requests into `master` run `.github/workflows/check.yml`, which checks formatting, builds the site and audits it with [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci), but never deploys. Only the merge deploys. The Lighthouse settings are in `lighthouserc.json`. It audits `/`, `/privacy/` and `/404.html` three times each and fails the check if accessibility drops below 100, SEO below 100 (except on the `noindex` 404 page) or best practices below 95. Performance only warns, because shared runners give noisy scores. The HTML reports are attached to the workflow run as `lighthouse-reports`. Run `npm run lighthouse` to audit locally; the reports go to `.lighthouseci/reports/`. `@lhci/cli` runs through `npx` at a pinned version rather than from `package.json`, because its dependencies have open `npm audit` advisories.

[Dependabot](https://docs.github.com/en/code-security/dependabot) (`.github/dependabot.yml`) opens dependency PRs every Monday: one grouped PR for npm minor and patch updates, a separate one for each npm major, and one for GitHub Actions. They go through the same Check workflow. Merging one that changes `package-lock.json` deploys the site.

Pushing to `master` runs `.github/workflows/deploy.yml` when the push touches something that affects the built site (`src/`, `public/`, dependencies, build config, or the deploy script and workflow themselves). Commits that only change the README, docs or other tooling don't deploy. You can also run it by hand from the Actions tab. The workflow builds the site and uploads `dist/` with rsync over SSH. The server's SSH port is firewalled, so the runner joins the tailnet first and connects to the server's Tailscale address. It needs these repository secrets:

| Secret                 | Value                                             |
| ---------------------- | ------------------------------------------------- |
| `DEPLOY_HOST`          | Server's Tailscale IP (`tailscale ip -4`)         |
| `DEPLOY_USER`          | SSH user                                          |
| `DEPLOY_PATH`          | Web root, e.g. `/var/www/mark-eriksson.com`       |
| `DEPLOY_PORT`          | Optional, defaults to 22                          |
| `DEPLOY_SSH_KEY`       | Private key for a deploy-only key pair            |
| `DEPLOY_KNOWN_HOSTS`   | Output of `ssh-keyscan <DEPLOY_HOST>`             |
| `TS_OAUTH_CLIENT_ID`   | Tailscale OAuth client ID (auth keys write scope) |
| `TS_OAUTH_SECRET`      | Tailscale OAuth client secret                     |
| `CLOUDFLARE_ZONE_ID`   | Optional, Cloudflare zone ID for the site         |
| `CLOUDFLARE_API_TOKEN` | Optional, token with only Zone → Cache Purge      |

The OAuth client must be allowed to create devices tagged `tag:ci`. See [docs/deploying.md](docs/deploying.md) for how the whole flow works, setup from scratch, and troubleshooting.

To deploy by hand, copy `.env.example` to `.env`, fill it in, then:

```shell
./scripts/deploy.sh -n   # dry run
npm run deploy           # build + upload
```

The upload uses `rsync --delete`, so anything in the web root that isn't in `dist/` is removed, apart from `.well-known/` and `check/`, which are managed separately. Do a dry run first.

After the upload, any changed file that keeps its URL (`index.html`, `sitemap.xml`, favicons and so on) is purged from Cloudflare's cache. Hashed files in `assets/` get a new URL when they change, so they're skipped. The purge only runs when both Cloudflare settings are set, and a dry run lists what it would purge.

## License

There's no open-source license, so all rights are reserved. The code is public to read and learn from. The project screenshots show client sites, and those sites belong to their owners.
