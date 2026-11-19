#!/bin/bash
# Installed on the server as /usr/local/bin/arcverus-set-resend-key
# Prompts for the ArcVerus Resend API key (input hidden) and saves it to
# /etc/arcverus/contact.env, readable only by root and the arcverus user.
# The key never goes into git, shell history or the command line.
#
# Run from the PC:  ssh -t root@5.161.66.0 arcverus-set-resend-key
set -euo pipefail

ENV_DIR=/etc/arcverus
ENV_FILE=$ENV_DIR/contact.env

install -d -m 750 -o root -g arcverus "$ENV_DIR"

read -rsp "Paste the ArcVerus Resend API key (input is hidden), then press Enter: " KEY
echo
KEY="${KEY//[[:space:]]/}"

if [[ ! "$KEY" =~ ^re_[A-Za-z0-9_]{20,}$ ]]; then
  echo "That doesn't look like a Resend key (should start with re_). Nothing saved."
  exit 1
fi

umask 027
TMP=$(mktemp "$ENV_DIR/.contact.env.XXXXXX")
# Keep any other settings already in the file; replace only the key line.
if [[ -f "$ENV_FILE" ]]; then grep -v '^RESEND_API_KEY=' "$ENV_FILE" > "$TMP" || true; fi
printf 'RESEND_API_KEY=%s\n' "$KEY" >> "$TMP"
chown root:arcverus "$TMP"
chmod 640 "$TMP"
mv "$TMP" "$ENV_FILE"

echo "Saved. Key ends in ...${KEY: -4} ($ENV_FILE, mode 640, root:arcverus)."
if systemctl is-enabled -q arcverus-contact 2>/dev/null; then
  systemctl restart arcverus-contact && echo "Contact form service restarted with the new key."
fi
