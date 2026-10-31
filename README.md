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
public/              Copied as-is to the site root (favicon, robots.txt, sitemap.xml, ads.txt)
scripts/             Screenshot capture and deploy scripts
dist/                Build output, which is what goes on the server (git-ignored)
```

## Scripts

| Command               | What it does                               |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Start the dev server                       |
| `npm run typecheck`   | Check TypeScript types                     |
| `npm run build`       | Type-check, then build to `dist/`          |
| `npm run preview`     | Serve `dist/` locally                      |
| `npm run screenshots` | Capture project screenshots (see below)    |
| `npm run deploy`      | Build and upload to the server (see below) |

Absolute URLs in `src/index.html` (`og:url`, `og:image`) use `%VITE_SITE_URL%`, which is set in `.env.development` (localhost) and `.env.production` (the live domain).

## Adding a project

Projects are listed in `src/data/projects.ts`. Each one gets a full-page desktop (1440px) and mobile (390px) screenshot, saved as `src/assets/screenshots/<id>-desktop.webp` and `<id>-mobile.webp`.

Add the project to `src/data/projects.ts`, then capture its screenshots:

```shell
npm run screenshots                  # capture projects with no screenshots yet
npm run screenshots -- crown-oil     # recapture specific project ids
npm run screenshots -- --all         # recapture everything
```

This runs on your machine rather than in Docker and drives your installed Google Chrome. Cookie banners, chat widgets and other floating overlays are hidden before each capture.

## Deploying

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds the site and uploads `dist/` with rsync over SSH. The server's SSH port is firewalled, so the runner joins the tailnet first and connects to the server's Tailscale address. It needs these repository secrets:

| Secret               | Value                                             |
| -------------------- | ------------------------------------------------- |
| `DEPLOY_HOST`        | Server's Tailscale IP (`tailscale ip -4`)         |
| `DEPLOY_USER`        | SSH user                                          |
| `DEPLOY_PATH`        | Web root, e.g. `/var/www/mark-eriksson.com`       |
| `DEPLOY_PORT`        | Optional, defaults to 22                          |
| `DEPLOY_SSH_KEY`     | Private key for a deploy-only key pair            |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan <DEPLOY_HOST>`             |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID (auth keys write scope) |
| `TS_OAUTH_SECRET`    | Tailscale OAuth client secret                     |

The OAuth client must be allowed to create devices tagged `tag:ci`. See [docs/deploying.md](docs/deploying.md) for how the whole flow works, setup from scratch, and troubleshooting.

To deploy by hand, copy `.env.example` to `.env`, fill it in, then:

```shell
./scripts/deploy.sh -n   # dry run
npm run deploy           # build + upload
```

The upload uses `rsync --delete`, so anything in the web root that isn't in `dist/` is removed, apart from `.well-known/` and `check/`, which are managed separately. Do a dry run first.
