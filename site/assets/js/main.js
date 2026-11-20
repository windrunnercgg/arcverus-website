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

  /* ---------- Contact form ---------- */
  const form = document.querySelector('.contact-form');
  if (!form) return;

  const message = form.querySelector('#message');
  const counter = form.querySelector('#message-count');
  const status = form.querySelector('.form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

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

  const setStatus = (text, kind) => {
    status.textContent = text;
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
      form.reset();
      if (message) message.dispatchEvent(new Event('input'));
      // Go to the thank-you page if the form names one; otherwise thank them in place
      if (form.dataset.successUrl) {
        window.location.href = form.dataset.successUrl;
        return;
      }
      setStatus('Thank you! Your message has been sent. We will be in touch soon.', 'success');
    } catch (err) {
      setStatus(err.message || 'Sorry, something went wrong sending your message. Please try again, or call us at (770) 367-4027.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
