/**
 * Lightweight Google Analytics 4 loader.
 * - load(id): injects gtag.js for the given Measurement ID (G-XXXXXXXXXX).
 * - pageview(path): sends a page_view event.
 * - event(name, params): generic event helper.
 *
 * Safe to call multiple times; the script is loaded only once per ID.
 */
let currentId = null;

const ensureDataLayer = () => {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
};

export const loadGA = (id) => {
  if (!id || typeof window === 'undefined') return;
  if (currentId === id) return;
  if (!/^G-[A-Z0-9]+$/i.test(id)) return; // ignore obviously invalid IDs
  ensureDataLayer();
  // Avoid duplicate <script>
  if (!document.querySelector(`script[data-ga-id="${id}"]`)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    s.setAttribute('data-ga-id', id);
    document.head.appendChild(s);
  }
  window.gtag('js', new Date());
  window.gtag('config', id, { send_page_view: false }); // we send manually per route
  currentId = id;
};

export const pageview = (path) => {
  if (!currentId || typeof window === 'undefined') return;
  ensureDataLayer();
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: currentId,
  });
};

export const event = (name, params = {}) => {
  if (!currentId || typeof window === 'undefined') return;
  ensureDataLayer();
  window.gtag('event', name, params);
};
