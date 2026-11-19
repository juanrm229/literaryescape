/* postmortem service worker — app shell + static assets offline, pages network-first. */
const VERSION = 'pm-v2';
const SHELL = ['/offline', '/pwa-icon/192', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // static build assets and fonts: cache-first (they are content-hashed)
  if (url.pathname.startsWith('/_next/static/') || url.hostname.includes('fonts.g')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // page navigations: network first, last good copy second, offline page last
  if (req.mode === 'navigate' && url.origin === self.location.origin && !url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/offline'))),
    );
  }
});
