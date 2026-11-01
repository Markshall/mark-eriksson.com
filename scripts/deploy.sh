#!/usr/bin/env bash
# Upload the built site in dist/ to the web server over SSH.
#
# Usage: npm run deploy            (build + upload)
#        ./scripts/deploy.sh -n    (dry run: show what would change)
#
# Settings come from the environment or a git-ignored .env file:
#   DEPLOY_HOST  e.g. mark-eriksson.com
#   DEPLOY_USER  SSH user
#   DEPLOY_PATH  web root on the server, e.g. /var/www/mark-eriksson.com
#   DEPLOY_PORT  optional, defaults to 22
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

: "${DEPLOY_HOST:?DEPLOY_HOST is not set}"
: "${DEPLOY_USER:?DEPLOY_USER is not set}"
: "${DEPLOY_PATH:?DEPLOY_PATH is not set}"

if [[ ! -f dist/index.html ]]; then
  echo "dist/ is empty — run 'npm run build' first." >&2
  exit 1
fi

dry_run=
for arg in "$@"; do
  case "$arg" in
    --dry-run | -[!-]*n*) dry_run=1 ;;
  esac
done

# rsync prints one itemized line per change ("<f..." for a sent file), which
# is saved so the purge below knows what changed.
changes=$(mktemp)
trap 'rm -f "$changes"' EXIT

# CI logs are public, so only print a summary there rather than every file name.
if [[ -n "${CI:-}" ]]; then
  stats=(--stats)
  show() { grep -vE '^(\*deleting|[<>ch.][fdLDS][^ ]*) ' || true; }
else
  stats=()
  show() { cat; }
fi

# --checksum compares contents rather than modification times, which a fresh
# build always changes, so only files that really changed are sent and listed.
# --delete removes old hashed assets. Paths managed outside this repo are
# protected from it: Let's Encrypt's /.well-known/ and the CheckCheck app at /check/.
rsync -az --checksum --delete ${stats[@]+"${stats[@]}"} \
  --out-format='%i %n' \
  --filter='P /.well-known/' \
  --filter='P /check/' \
  -e "ssh -p ${DEPLOY_PORT:-22}" \
  "$@" \
  dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH%/}/" |
  tee "$changes" | show

./scripts/purge-cache.sh "$changes" ${dry_run:+--dry-run}
