# mark-eriksson.com
[Preview link](https://www.mark-eriksson.com)

The files to my online portfolio, mark-eriksson.com

## Previews

### Desktop
![Desktop version](https://markshall.github.io/screenshots/mark-eriksson.com/desktop_2.png)

### Mobile
![Mobile version](https://markshall.github.io/screenshots/mark-eriksson.com/mobile_2.png)

## Project layout

```
src/        Site source: index.html, styles/, scripts/, assets/ (Vite processes and hashes these)
public/     Copied as-is to the site root (favicon, robots.txt, sitemap.xml, ads.txt, og:image)
dist/       Build output — this is what goes on the server (git-ignored)
```

## Development

Run the Vite dev server in Docker (with hot reload) at http://localhost:5173:

```shell
docker compose up
```

Dependencies are reinstalled in the container automatically when `package-lock.json` changes.

## Project screenshots

Full-page desktop (1440px) and mobile (390px) screenshots of each project are saved to `src/assets/screenshots/<id>-desktop.webp` and `<id>-mobile.webp`. Projects are listed in `src/data/projects.js`, which the site also reads.

To add a project, add it to `src/data/projects.js`, then run:

```shell
npm run screenshots                 # capture projects with no screenshots yet
npm run screenshots -- crownoil     # recapture specific project ids
npm run screenshots -- --all        # recapture everything
```

This runs on your machine rather than in Docker, and uses your installed Google Chrome. Cookie banners, chat widgets and other floating overlays are hidden before each capture.

## Build

```shell
npm run build    # outputs to dist/
npm run preview  # serve dist/ locally
```

## Deploy

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds the site and uploads `dist/` with rsync over SSH. Add these repository secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Server hostname |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_PATH` | Web root, e.g. `/var/www/mark-eriksson.com` |
| `DEPLOY_PORT` | Optional, defaults to 22 |
| `DEPLOY_SSH_KEY` | Private key for a deploy-only key pair |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan <host>` |

To deploy by hand, copy `.env.example` to `.env`, fill it in, then:

```shell
./scripts/deploy.sh -n   # dry run
npm run deploy           # build + upload
```

The upload uses `rsync --delete`, so anything in the web root that isn't in `dist/` is removed (except `.well-known/`). Do a dry run first.
