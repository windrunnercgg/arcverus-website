# ArcVerus Deployment Guide

ArcVerus runs on the same Hetzner server as Chaotic Good Gaming (`cgg-ubuntu-prod`, `5.161.66.0` / `2a01:4ff:f0:577a::1`).
nginx serves both sites from the same IP and picks the right site by domain name, so no extra IPs are needed.

| Item | Value |
|---|---|
| Main address | https://www.arcverus.com |
| Redirects to main | `arcverus.com`, `www.arcverus.net`, `arcverus.net`, all `http://` |
| Site files | `/var/www/arcverus/site` (only the repo's `site/` and `api/` folders are checked out) |
| File owner | `arcverus` system user (no login shell), kept separate from CGG's `cggapp` |
| nginx config | `/etc/nginx/sites-available/www-arcverus` → symlinked in `sites-enabled` |
| SSL certificate | Let's Encrypt, cert name `arcverus`, renewed by the existing `certbot.timer` |
| Deploy script | `/usr/local/bin/arcverus-deploy` (source: `deploy/arcverus-deploy.sh`) |
| DNS | GoDaddy: A `@` → `5.161.66.0`; `www` CNAME → `@` (both domains) |

## Routine deploy

1. Commit and push to `main` on GitHub.
2. Run:

```powershell
ssh root@5.161.66.0 arcverus-deploy
```

The script fetches `main` from the public GitHub repo and resets the server copy to it. It prints the deployed commit.
No restart is needed for the static site. If anything in `api/` changed, the script restarts the
contact form service and stops with an error if it doesn't come back up.

> SSH from this PC uses the key `hetzner-cgg-production`, unlocked in the Windows ssh-agent
> (`ssh-add $env:USERPROFILE\.ssh\id_ed25519`). Use Windows' `ssh.exe` (PowerShell), not Git Bash's,
> because only the Windows one talks to that agent.

## Why the config looks the way it does

- **File name `www-arcverus`:** nginx loads `sites-enabled` alphabetically, and the first site loaded becomes
  the fallback for unknown hostnames and the bare IP. "www-…" sorts after the `cgg-*` files, so CGG keeps that role.
- **No `ipv6only=on`:** CGG's config already sets it on `[::]:443`, and it may appear only once per address and port.
- **No `http2`:** on nginx 1.24, `http2` on a `listen` line applies to every site on that port, which would change CGG too.
- **Caching:** HTML, CSS and JS use `no-cache` (browsers re-check every visit, so deploys show immediately).
  Fonts and images are cached for 30 days. If you replace an image but keep the same file name, rename it
  (e.g. `logo-v2.svg`) so browsers fetch the new one.

## First-time setup (already done, kept for reference)

```bash
# On the server, as root
useradd --system --create-home --shell /usr/sbin/nologin arcverus
# (from PC) scp deploy/arcverus-deploy.sh root@5.161.66.0:/usr/local/bin/arcverus-deploy
chmod 755 /usr/local/bin/arcverus-deploy
arcverus-deploy                       # clones the repo into /var/www/arcverus

# Stage 1: HTTP-only config so Certbot can verify the domains
# (from PC) scp deploy/nginx-arcverus-http.conf root@5.161.66.0:/etc/nginx/sites-available/www-arcverus
ln -s /etc/nginx/sites-available/www-arcverus /etc/nginx/sites-enabled/www-arcverus
nginx -t && systemctl reload nginx

# After DNS points at the server: get the certificate (config is not modified by "certonly")
certbot certonly --nginx --cert-name arcverus \
  -d www.arcverus.com -d arcverus.com -d www.arcverus.net -d arcverus.net

# Stage 2: final config with SSL and redirects
# (from PC) scp deploy/nginx-arcverus.conf root@5.161.66.0:/etc/nginx/sites-available/www-arcverus
nginx -t && systemctl reload nginx
```

### Gotchas hit during setup

- `scp` from Windows failed once with "Connection closed". Sending a file through ssh works reliably:
  `Get-Content -Raw file | ssh root@5.161.66.0 "sed -e '1s/^\xEF\xBB\xBF//' -e 's/\r$//' > /tmp/file"`
  (the `sed` strips the BOM and Windows line endings that PowerShell adds).
- `certbot renew --dry-run` run without a terminal waits a random few minutes on purpose. Add
  `--no-random-sleep-on-renew` when testing by hand.

## Checks

```powershell
nslookup www.arcverus.com 8.8.8.8          # should return 5.161.66.0
curl.exe -I https://www.arcverus.com        # 200
curl.exe -I http://arcverus.net             # 301 → https://www.arcverus.com/
```

## Contact form

The form on the homepage posts to `/api/contact`. nginx forwards that to `api/server.js`, a small
Node program with no dependencies, which emails the message to `info@arcverus.com` through Resend.

| Item | Value |
|---|---|
| Service | `arcverus-contact` (systemd unit, source: `deploy/arcverus-contact.service`) |
| Runs as | `arcverus` user, on `127.0.0.1:3101` only, with a read-only view of the system |
| Code | `/var/www/arcverus/api/server.js` (deployed with the site; restarted automatically when it changes) |
| API key | `/etc/arcverus/contact.env` (`root:arcverus`, mode 640), never in git |
| Resend | Same account as CGG. Domain `arcverus.com` (us-east-1). Key "ArcVerus Contact Form", sending access, arcverus.com only |
| Sender | `ArcVerus Website <noreply@arcverus.com>`, reply-to = the visitor |
| DNS for Resend | TXT `resend._domainkey`, CNAME `send` and `rsend` (GoDaddy). The Microsoft 365 mailbox records are separate; don't edit the SPF on `@` |
| Limits | 5 messages per visitor per 10 minutes, 100 per day overall (API); 6 requests/min per IP (nginx) |

```powershell
ssh -t root@5.161.66.0 arcverus-set-resend-key        # replace the API key (prompts, input hidden; restarts the service)
ssh root@5.161.66.0 systemctl status arcverus-contact  # is it running?
ssh root@5.161.66.0 journalctl -u arcverus-contact -n 50   # log: one line per message, no personal details
```

Local test without sending anything: `cd api; $env:DRY_RUN='1'; node server.js` then POST JSON to
`http://127.0.0.1:3101/api/contact` (it prints the email it would have sent).

If form emails land in Junk in Microsoft 365, mark them "Not junk"; if that doesn't stick, add a
mail-flow rule in the Exchange admin center for sender `noreply@arcverus.com`.
