/*
 * ArcVerus — Google Tag Manager and data layer events
 * ------------------------------------------------------------------
 * Loaded near the top of <head> on every page:
 *   <script src="assets/js/tracking.js"></script>   (service pages: ../assets/js/tracking.js)
 * The GTM container ID lives only in this file.
 *
 * Events pushed to window.dataLayer (service_name is always a page slug or "general"):
 *   view_service         { service_name }  pages with <body data-service-name="<slug>">
 *   form_submit_success  { service_name }  the page loaded right after a successful contact-form send.
 *                                          main.js stores the slug in sessionStorage just before it
 *                                          redirects to the thank-you page; it is read once, then removed.
 * tel: and mailto: links need no code here: GTM's built-in Click URL variable detects them.
 */
(function () {
  'use strict';

  var GTM_ID = 'GTM-PDWJ2TZZ';
  var SUCCESS_KEY = 'arcverus:form_success'; // written by main.js
  var SLUG_RE = /^[a-z0-9-]{1,60}$/;        // shape check; main.js and the API hold the actual allowlist

  var dataLayer = (window.dataLayer = window.dataLayer || []);

  /* ---------- Google Tag Manager (standard loader) ---------- */
  dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var gtm = document.createElement('script');
  gtm.async = true;
  gtm.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  var firstScript = document.getElementsByTagName('script')[0];
  firstScript.parentNode.insertBefore(gtm, firstScript);

  /* ---------- form_submit_success (once, on the page after the redirect) ---------- */
  var sent = null;
  try {
    sent = sessionStorage.getItem(SUCCESS_KEY);
    sessionStorage.removeItem(SUCCESS_KEY);
  } catch (e) { /* storage blocked: no event */ }
  if (sent) {
    dataLayer.push({ event: 'form_submit_success', service_name: SLUG_RE.test(sent) ? sent : 'general' });
  }

  /* ---------- view_service (needs <body>, so wait for the page to parse) ---------- */
  function pushServiceView() {
    var slug = document.body && document.body.getAttribute('data-service-name');
    if (slug && SLUG_RE.test(slug)) {
      dataLayer.push({ event: 'view_service', service_name: slug });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pushServiceView);
  } else {
    pushServiceView();
  }
})();
