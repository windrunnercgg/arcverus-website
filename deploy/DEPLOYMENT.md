# ArcVerus Deployment Guide

ArcVerus runs on the same Hetzner server as Chaotic Good Gaming (`cgg-ubuntu-prod`, `5.161.66.0` / `2a01:4ff:f0:577a::1`).
nginx serves both sites from the same IP and picks the right site by domain name, so no extra IPs are needed.

| Item | Value |
|---|---|
| Main address | https://www.arcverus.com |
| Redirects to main | `arcverus.com`, `www.arcverus.net`, `arcverus.net`, all `http://` |
| Site files | `/var/www/arcverus/site` (only the repo's `site/` folder is checked out) |
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
No restart is needed for a static site.

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

## Checks

```powershell
nslookup www.arcverus.com 8.8.8.8          # should return 5.161.66.0
curl.exe -I https://www.arcverus.com        # 200
curl.exe -I http://arcverus.net             # 301 → https://www.arcverus.com/
```

## Later: contact form

When `info@arcverus.com` exists, the contact form API (Node + Resend, run by PM2) is added. Its nginx
`location /api/` block is already in `nginx-arcverus.conf`, commented out.
