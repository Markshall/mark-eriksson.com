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

# --delete removes old hashed assets; .well-known/ (e.g. Let's Encrypt) is protected.
rsync -avz --delete --filter='P .well-known/' \
  -e "ssh -p ${DEPLOY_PORT:-22}" \
  "$@" \
  dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH%/}/"
