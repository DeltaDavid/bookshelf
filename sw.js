// Silent unregister service worker.
// Previous version forced clients to navigate on activate, creating a
// register -> activate -> reload loop (visible as prolonged flicker).
// This version unregisters quietly without touching the page.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
