#!/usr/bin/env node
/*
 * ArcVerus — create a service page
 * ------------------------------------------------------------------
 * Usage (from the repo root):
 *   node scripts/new-service-page.js scripts/service-page.example.json
 *   node scripts/new-service-page.js my-page.json --force      (overwrite an existing page)
 *
 * Writes site/services/<slug>.html from the shared template below, so every new page gets
 * the same header, footer, tracking (tracking.js + data-service-name), booking button
 * (Calendly, data-cta="service-page") and call-to-action phone number as the existing pages.
 *
 * It also adds the slug to the SERVICES allowlists in site/assets/js/main.js and api/server.js,
 * so the contact form accepts it as a service_name.
 *
 * Still manual afterwards: a card on the homepage (site/index.html, #services) and the page image
 * in site/assets/images/services/. Then deploy as usual.
 *
 * The page JSON (see scripts/service-page.example.json). Text fields are HTML: write & as &amp;.
 *   slug       lowercase-with-dashes; becomes the file name and the service_name everywhere
 *   icon       file in site/assets/images/icons/
 *   title      page heading
 *   desc       meta description (plain text, ~150 characters)
 *   lead       intro paragraph
 *   media      { "type": "photo" | "illustration", "src": "services/x.webp", "w": 660, "h": 858, "alt": "..." }
 *              or { "type": "svg", "svg": "<svg ...>...</svg>" }
 *   help       paragraphs for "How We Help"
 *   features   [ ["Title", "Text"], ... ]  (4 fit the grid best)
 *   ctaTitle, ctaText   call-to-action heading and line
 *
 * Options: --root <dir>  repo root to write into (default: this script's repo). Used for testing.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* ---------- Arguments ---------- */
function fail(msg) { console.error(`Error: ${msg}`); process.exit(1); }

let force = false;
let root = path.resolve(__dirname, '..');
let input = null;
for (const args = process.argv.slice(2); args.length;) {
  const a = args.shift();
  if (a === '--force') force = true;
  else if (a === '--root') root = path.resolve(args.shift() || fail('--root needs a folder'));
  else if (a.startsWith('--')) fail(`unknown option ${a}`);
  else input = a;
}
if (!input) fail('usage: node scripts/new-service-page.js <page.json> [--force]');

/* ---------- Load and check the page data ---------- */
let p;
try { p = JSON.parse(fs.readFileSync(input, 'utf8')); } catch (e) { fail(`cannot read ${input}: ${e.message}`); }

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
if (!SLUG_RE.test(p.slug || '') || p.slug === 'general') fail('slug must be lowercase-with-dashes (and not "general")');
for (const key of ['icon', 'title', 'desc', 'lead', 'ctaTitle', 'ctaText']) {
  if (typeof p[key] !== 'string' || !p[key].trim()) fail(`"${key}" is required`);
}
if (!Array.isArray(p.help) || !p.help.length) fail('"help" must be a list of paragraphs');
if (!Array.isArray(p.features) || !p.features.every((f) => Array.isArray(f) && f.length === 2)) fail('"features" must be a list of [title, text] pairs');
if (!p.media || !['photo', 'illustration', 'svg'].includes(p.media.type)) fail('"media.type" must be photo, illustration or svg');
if (p.media.type !== 'svg' && !(p.media.src && p.media.w && p.media.h && p.media.alt)) fail('"media" needs src, w, h and alt');
if (p.media.type === 'svg' && !/^<svg[\s>]/.test(p.media.svg || '')) fail('"media.svg" must be an <svg> element');
if (!fs.existsSync(path.join(root, 'site/assets/images/icons', p.icon))) fail(`icon not found: site/assets/images/icons/${p.icon}`);

const outFile = path.join(root, 'site/services', `${p.slug}.html`);
if (fs.existsSync(outFile) && !force) fail(`site/services/${p.slug}.html already exists (use --force to overwrite)`);

/* ---------- Template ---------- */
// Straight apostrophes in copy → typographic ones (text only, never in attributes)
const typo = (s) => s.replace(/'/g, '&rsquo;');
const attr = (s) => s.replace(/"/g, '&quot;');

function mediaHtml(m) {
  if (m.type === 'svg') {
    return `<figure class="service-media service-media--illustration">
        ${m.svg}
      </figure>`;
  }
  const cls = m.type === 'photo' ? 'service-media--photo' : 'service-media--illustration';
  return `<figure class="service-media ${cls}">
        <img src="../assets/images/${attr(m.src)}" alt="${attr(m.alt)}" width="${Number(m.w)}" height="${Number(m.h)}">
      </figure>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="../assets/js/tracking.js"></script>
  <title>${p.title} | ArcVerus</title>
  <meta name="description" content="${attr(p.desc)}">
  <link rel="canonical" href="https://www.arcverus.com/services/${p.slug}.html">
  <link rel="icon" type="image/svg+xml" href="../assets/images/logo-arch-evergreen.svg">
  <link rel="preload" href="../assets/fonts/texgyreschola-regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../assets/fonts/texgyretermes-regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body data-service-name="${p.slug}">

  <!-- ===================== Header / nav (same as homepage; links point back to it) ===================== -->
  <header class="site-header">
    <nav class="nav-container" aria-label="Main">
      <a href="../index.html" class="nav-brand">
        <img src="../assets/images/logo-arch-sunflower-gold-green-details.png" alt="" class="nav-logo" width="75" height="93">
        <span class="brand-name nav-name">ArcVerus</span>
      </a>
      <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-links">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-links" id="nav-links">
        <li><a href="../index.html">Home</a></li>
        <li><a href="../index.html#about">About</a></li>
        <li><a href="../index.html#services" aria-current="page">Services</a></li>
        <li><a href="../index.html#why-us">Why Us</a></li>
        <li><a href="../index.html#contact">Contact</a></li>
      </ul>
      <a href="https://calendly.com/garner-arcverus/digital-marketing-assessment-call?utm_source=arcverus.com&amp;utm_medium=website&amp;utm_campaign=assessment-call&amp;utm_content=header" class="btn btn-gold nav-book" target="_blank" rel="noopener noreferrer" data-cta="header">Book a call<span class="sr-only"> (opens in a new tab)</span></a>
    </nav>
  </header>

  <main>

    <!-- ===================== Service intro ===================== -->
    <section class="section section--light service-hero">
      <div class="container split split--60-40">
        <div>
          <p class="breadcrumb"><a href="../index.html#services">Services</a> /</p>
          <h1 class="heading-xl c-green service-title">
            <span class="icon-badge"><img src="../assets/images/icons/${attr(p.icon)}" alt="" width="32" height="32"></span>
            <span>${p.title}</span>
          </h1>
          <p class="service-lead">${typo(p.lead)}</p>
        </div>
        ${mediaHtml(p.media)}
      </div>
    </section>

    <!-- ===================== How we help ===================== -->
    <section class="section section--dark">
      <div class="container">
        <div class="prose">
          <h2 class="heading-lg c-gold">How We Help</h2>
${p.help.map((t) => `          <p class="text-lg">${typo(t)}</p>`).join('\n')}
        </div>
        <ul class="feature-grid">
${p.features.map(([h, t]) => `          <li class="feature">
            <h3 class="feature-title">${h}</h3>
            <p class="feature-text">${typo(t)}</p>
          </li>`).join('\n')}
        </ul>
      </div>
    </section>

    <!-- ===================== Call to action ===================== -->
    <section class="section section--light service-cta">
      <div class="container stack-center">
        <h2 class="heading-xl c-green">${typo(p.ctaTitle)}</h2>
        <p class="text-md">${typo(p.ctaText)}</p>
        <a href="https://calendly.com/garner-arcverus/digital-marketing-assessment-call?utm_source=arcverus.com&amp;utm_medium=website&amp;utm_campaign=assessment-call&amp;utm_content=service-page" class="btn btn-gold btn-book" target="_blank" rel="noopener noreferrer" data-cta="service-page">Book a Digital Marketing Assessment call<span class="sr-only"> (opens in a new tab)</span></a>
        <dl class="contact-info service-phone">
          <div class="contact-item">
            <dt>Phone</dt>
            <dd><a href="tel:+17703674027">(770) 367-4027</a></dd>
          </div>
        </dl>
        <a href="../index.html#services" class="back-link">&larr; View All Services</a>
      </div>
    </section>

  </main>

  <!-- ===================== Footer ===================== -->
  <footer class="site-footer">
    <p class="footer-book"><a href="https://calendly.com/garner-arcverus/digital-marketing-assessment-call?utm_source=arcverus.com&amp;utm_medium=website&amp;utm_campaign=assessment-call&amp;utm_content=footer" target="_blank" rel="noopener noreferrer" data-cta="footer">Book a Digital Marketing Assessment call<span class="sr-only"> (opens in a new tab)</span></a></p>
    <p>&copy; 2026 ArcVerus. All rights reserved. <span aria-hidden="true">&middot;</span> <a href="/privacy.html">Privacy Policy</a></p>
  </footer>

  <script src="../assets/js/main.js"></script>
</body>
</html>
`;

/* ---------- Add the slug to the SERVICES allowlists ---------- */
function addToAllowlist(relFile) {
  const file = path.join(root, relFile);
  const src = fs.readFileSync(file, 'utf8');
  const re = /const SERVICES = \[([^\]]*)\];/g;
  const matches = [...src.matchAll(re)];
  if (matches.length !== 1) fail(`expected one "const SERVICES = [...]" line in ${relFile}, found ${matches.length}`);
  const slugs = [...matches[0][1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  if (slugs.includes(p.slug)) return `${relFile}: already listed`;
  const updated = src.replace(re, `const SERVICES = [${[...slugs, p.slug].map((s) => `'${s}'`).join(', ')}];`);
  fs.writeFileSync(file, updated);
  return `${relFile}: added '${p.slug}'`;
}

// Check both allowlists before writing anything, so a failure leaves no half-done change
for (const f of ['site/assets/js/main.js', 'api/server.js']) {
  const n = [...fs.readFileSync(path.join(root, f), 'utf8').matchAll(/const SERVICES = \[([^\]]*)\];/g)].length;
  if (n !== 1) fail(`expected one "const SERVICES = [...]" line in ${f}, found ${n}`);
}

fs.writeFileSync(outFile, html);
console.log(`wrote site/services/${p.slug}.html`);
console.log(addToAllowlist('site/assets/js/main.js'));
console.log(addToAllowlist('api/server.js'));
console.log(`
Next:
  1. Add the page image (if any) under site/assets/images/${p.media.type === 'svg' ? '(not needed: inline SVG)' : p.media.src}
  2. Add a card linking to services/${p.slug}.html in the homepage Services grid (site/index.html)
  3. Preview with "npm run dev", then commit and deploy (api/server.js changed, so the deploy restarts the form API)`);
