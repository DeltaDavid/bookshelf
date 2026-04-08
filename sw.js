// Self-destructing service worker - clears all caches and unregisters
// Deployed during Netlify > Cloudflare Pages migration

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(c => c.navigate(c.url));
      })
      .then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
