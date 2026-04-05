// Network-first: never serve stale app files
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', e => {
  // Only cache third-party/static assets, never app files
  if (e.request.url.includes(self.location.origin)) return;
});
