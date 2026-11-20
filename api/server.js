/*
 * ArcVerus contact form API
 * ------------------------------------------------------------------
 * POST /api/contact  { name, email, message, service, website }  → emails info@arcverus.com via Resend
 *                    (service: a service page slug or "general"; website: honeypot, must be empty)
 * GET  /api/health   → { ok: true }
 *
 * No dependencies: Node 18+ has fetch built in. Runs behind nginx on 127.0.0.1.
 *
 * Settings (environment):
 *   RESEND_API_KEY  required to send (from /etc/arcverus/contact.env on the server)
 *   PORT            default 3101
 *   CONTACT_TO      default info@arcverus.com
 *   CONTACT_FROM    default "ArcVerus Website <noreply@arcverus.com>"
 *   ALLOWED_ORIGIN  default https://www.arcverus.com (browsers must post from this site)
 *   DRY_RUN=1       log the email instead of sending it (local testing)
 */
'use strict';

const http = require('node:http');

const PORT = Number(process.env.PORT) || 3101;
const API_KEY = process.env.RESEND_API_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1';
const TO = process.env.CONTACT_TO || 'info@arcverus.com';
const FROM = process.env.CONTACT_FROM || 'ArcVerus Website <noreply@arcverus.com>';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://www.arcverus.com';

// Same limits as the form on the page
const LIMITS = { name: 100, email: 254, message: 2000 };
const MAX_BODY_BYTES = 16 * 1024;

// Which service page the visitor came from. Untrusted: anything not on this list becomes "general".
// Keep in sync with SERVICES in site/assets/js/main.js (scripts/new-service-page.js adds new slugs to both).
const SERVICES = ['strategic-consulting', 'data-management', 'enterprise-architecture', 'ai-consulting', 'creative-services', 'martech-platform', 'analytics', 'ecommerce', 'project-management'];
const toService = (value) => (SERVICES.includes(value) ? value : 'general');

// Rate limits (in memory; reset when the service restarts)
const PER_IP_MAX = 5;                       // messages per visitor...
const PER_IP_WINDOW_MS = 10 * 60 * 1000;    // ...per 10 minutes
const DAILY_MAX = 100;                      // all visitors combined, per day (Resend free plan allows 100/day)

const EMAIL_RE = /^[^\s@<>()",;:]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

if (!API_KEY && !DRY_RUN) {
  console.error('RESEND_API_KEY is not set. Set it (or DRY_RUN=1 for testing). Exiting.');
  process.exit(1);
}

/* ---------- Rate limiting ---------- */
const hits = new Map(); // ip → [timestamps]
let day = new Date().toISOString().slice(0, 10);
let sentToday = 0;

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (recent.length >= PER_IP_MAX) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function dailyCapReached() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; sentToday = 0; }
  return sentToday >= DAILY_MAX;
}

// Drop old entries every 10 minutes so the map can't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((t) => now - t >= PER_IP_WINDOW_MS)) hits.delete(ip);
  }
}, PER_IP_WINDOW_MS).unref();

/* ---------- Helpers ---------- */
function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { tooLarge = true; chunks.length = 0; return; } // keep draining, discard
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('too large'), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

// Remove control characters (keep newlines and tabs in the message only)
const clean = (s, keepNewlines) =>
  String(s ?? '')
    .replace(keepNewlines ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, keepNewlines ? '' : ' ')
    .replace(/\r\n?/g, '\n')
    .trim();

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function validate(raw) {
  const data = {
    name: clean(raw.name, false),
    email: clean(raw.email, false),
    message: clean(raw.message, true),
    service: toService(raw.service), // never rejected, just normalized
  };
  // Count characters the way the browser does (code points), not bytes
  const len = (s) => [...s].length;
  if (!data.name || len(data.name) > LIMITS.name) return { error: 'Please enter your name (up to 100 characters).' };
  if (!data.email || len(data.email) > LIMITS.email || !EMAIL_RE.test(data.email)) return { error: 'Please enter a valid email address.' };
  if (!data.message || len(data.message) > LIMITS.message) return { error: 'Please enter a message (up to 2,000 characters).' };
  return { data };
}

async function sendEmail({ name, email, message, service }) {
  const subject = `Website message from ${name}`.slice(0, 150);
  const text = `New message from the ArcVerus website contact form\n\nName:    ${name}\nEmail:   ${email}\nService: ${service}\n\n${message}\n`;
  const html =
    `<p><strong>New message from the ArcVerus website contact form</strong></p>` +
    `<p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}` +
    `<br><strong>Service:</strong> ${escapeHtml(service)}</p>` +
    `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

  const payload = { from: FROM, to: [TO], reply_to: email, subject, text, html };

  if (DRY_RUN) {
    console.log('[DRY_RUN] would send:', JSON.stringify({ ...payload, html: undefined }, null, 2));
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Resend responded ${res.status}: ${detail}`);
  }
  const { id } = await res.json().catch(() => ({}));
  return id;
}

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';

  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
  if (url.pathname !== '/api/contact') return send(res, 404, { error: 'Not found.' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Method not allowed.' }); }

  // Browsers always send Origin on a cross-site or fetch POST; reject posts from other sites
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Forbidden.' });

  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return send(res, 415, { error: 'Expected JSON.' });
  }

  let raw;
  try {
    raw = JSON.parse(await readBody(req));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not an object');
  } catch (err) {
    return err.status === 413
      ? send(res, 413, { error: 'Your message is too long.' })
      : send(res, 400, { error: 'Invalid request.' });
  }

  // Honeypot: real visitors never fill this in. Pretend it worked so bots don't adapt.
  if (clean(raw.website, false)) {
    console.log(`honeypot hit from ${ip}`);
    return send(res, 200, { ok: true });
  }

  const { data, error } = validate(raw);
  if (error) return send(res, 400, { error });

  if (rateLimited(ip)) {
    console.log(`rate limited ${ip}`);
    return send(res, 429, { error: 'Too many messages. Please wait a few minutes and try again, or call us at (770) 367-4027.' });
  }
  if (dailyCapReached()) {
    console.error('daily send cap reached');
    return send(res, 503, { error: 'Online messages are temporarily unavailable. Please call us at (770) 367-4027.' });
  }

  try {
    const id = await sendEmail(data);
    sentToday += 1;
    console.log(`sent ${id || '(dry run)'} from ${ip}`); // no personal details in logs
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error(`send failed from ${ip}: ${err.message}`);
    return send(res, 502, { error: 'Sorry, your message could not be sent. Please try again, or call us at (770) 367-4027.' });
  }
});

server.requestTimeout = 15000;
server.headersTimeout = 10000;

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ArcVerus contact API listening on 127.0.0.1:${PORT}${DRY_RUN ? ' (DRY_RUN)' : ''}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
