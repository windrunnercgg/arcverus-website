// ArcVerus — shared site script (loaded on every page)

(function () {
  /* ---------- Mobile nav ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      navLinks.classList.toggle('open');
    });

    // Close the mobile nav after choosing a link
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Header shadow once the page scrolls ---------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Service context (for the contact form and analytics) ---------- */
  // service values from the URL or browser storage are untrusted: only these slugs are accepted,
  // anything else becomes "general". Keep in sync with SERVICES in api/server.js
  // (scripts/new-service-page.js adds new slugs to both).
  const SERVICES = ['strategic-consulting', 'data-management', 'enterprise-architecture', 'ai-consulting', 'creative-services', 'martech-platform', 'analytics', 'ecommerce', 'project-management'];
  const toService = (value) => (SERVICES.includes(value) ? value : 'general');

  const LAST_SERVICE_KEY = 'arcverus:last_service'; // last service page viewed in this tab
  const SUCCESS_KEY = 'arcverus:form_success';      // read once by tracking.js after the redirect
  const store = {
    get: (key) => { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set: (key, value) => { try { sessionStorage.setItem(key, value); } catch (e) { /* storage blocked */ } },
  };

  // On a service page, remember it so a later visit to the contact form knows where they came from
  const pageService = document.body.dataset.serviceName;
  if (SERVICES.includes(pageService)) store.set(LAST_SERVICE_KEY, pageService);

  /* ---------- Contact form ---------- */
  const form = document.querySelector('.contact-form');
  if (!form) return;

  const message = form.querySelector('#message');
  const counter = form.querySelector('#message-count');
  const status = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  const serviceField = form.querySelector('input[name="service"]');

  // Which service the visitor is asking about: ?service=<slug> (if a link supplies one),
  // else the last service page viewed in this tab, else "general"
  if (serviceField) {
    const fromUrl = new URLSearchParams(window.location.search).get('service');
    serviceField.value = SERVICES.includes(fromUrl) ? fromUrl : toService(store.get(LAST_SERVICE_KEY));
  }

  // Live "characters remaining" counter
  if (message && counter) {
    const max = Number(message.getAttribute('maxlength')) || 2000;
    const update = () => {
      const left = max - message.value.length;
      counter.textContent = `${left} character${left === 1 ? '' : 's'} remaining`;
    };
    message.addEventListener('input', update);
    update();
  }

  // Show a status message; the phone number in it becomes a tap-to-call link
  // (built from text nodes, never innerHTML, since server messages pass through here)
  const PHONE_TEXT = '(770) 367-4027';
  const setStatus = (text, kind) => {
    status.replaceChildren();
    text.split(PHONE_TEXT).forEach((part, i) => {
      if (i > 0) {
        const link = document.createElement('a');
        link.href = 'tel:+17703674027';
        link.textContent = PHONE_TEXT;
        status.append(link);
      }
      if (part) status.append(part);
    });
    status.classList.remove('is-success', 'is-error');
    if (kind) status.classList.add(`is-${kind}`);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Built-in browser checks (required fields, email format)
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid');
      setStatus('Please fill in your name, a valid email address, and a message.', 'error');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Until the mailbox and email service are live, don't try to send
    if (form.dataset.live !== 'true') {
      setStatus('Online messages are coming soon. In the meantime, please call us at (770) 367-4027.', 'error');
      return;
    }

    submitBtn.disabled = true;
    setStatus('Sending…');

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!res.ok) {
        // The server explains validation and rate-limit problems in plain words
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (res.status === 429
          ? 'Too many messages. Please wait a few minutes and try again, or call us at (770) 367-4027.'
          : ''));
      }
      const service = toService(serviceField ? serviceField.value : '');
      form.reset();
      if (message) message.dispatchEvent(new Event('input'));
      // Go to the thank-you page if the form names one (tracking.js sends form_submit_success
      // there, so the event isn't lost to the page change); otherwise send it now and thank them in place
      if (form.dataset.successUrl) {
        store.set(SUCCESS_KEY, service);
        window.location.href = form.dataset.successUrl;
        return;
      }
      (window.dataLayer = window.dataLayer || []).push({ event: 'form_submit_success', service_name: service });
      setStatus('Thank you! Your message has been sent. We will be in touch soon.', 'success');
    } catch (err) {
      setStatus(err.message || 'Sorry, something went wrong sending your message. Please try again, or call us at (770) 367-4027.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
