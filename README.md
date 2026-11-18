# ArcVerus Website

Marketing website for **ArcVerus** (www.arcverus.com; arcverus.com and arcverus.net redirect to it).
Static HTML, CSS and vanilla JavaScript, with no build step.

## Folders

| Path | What it is |
|---|---|
| `site/` | The website itself. Only this folder is served by the web server. |
| `site/assets/css/styles.css` | All styles, organized into reusable sections (tokens, layout, components). |
| `site/assets/js/main.js` | Shared script: mobile nav, header shadow, contact form. |
| `site/assets/fonts/` | Self-hosted fonts (TeX Gyre Schola, TeX Gyre Termes, Inter) plus their licenses. |
| `deploy/` | Server config (nginx) and the deploy script. |
| `Images/` | Design references and source artwork (not deployed). |

## Preview locally

```
npm run dev
```

Then open http://localhost:3001 (port 3001, so it can run next to CGG on 3000).
Save a file and refresh the browser to see the change.

## Deploy

1. Commit and push to `main` on GitHub.
2. On the server: `ssh root@5.161.66.0 arcverus-deploy`

See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for the full server setup.
