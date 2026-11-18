#!/usr/bin/env bash
# ArcVerus deploy script. Installed on the server as /usr/local/bin/arcverus-deploy
# Pulls the latest main branch from GitHub into /var/www/arcverus (site/ folder only).
# Usage (from your PC):  ssh root@5.161.66.0 arcverus-deploy
set -euo pipefail

APP_DIR=/var/www/arcverus
APP_USER=arcverus
REPO=https://github.com/windrunnercgg/arcverus-website.git

run_as_app() { sudo -u "$APP_USER" -H "$@"; }

if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> First-time setup in $APP_DIR"
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  run_as_app git -C "$APP_DIR" init -q -b main
  run_as_app git -C "$APP_DIR" remote add origin "$REPO"
fi

# Only the website folder is checked out on the server
run_as_app git -C "$APP_DIR" sparse-checkout set --no-cone "/site/"

echo "==> Pulling latest main"
run_as_app git -C "$APP_DIR" fetch -q origin main
run_as_app git -C "$APP_DIR" reset -q --hard origin/main

echo "==> Deployed commit: $(run_as_app git -C "$APP_DIR" log -1 --format='%h %s (%cr)')"
