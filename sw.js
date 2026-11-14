// Offline-first service worker. Bump VERSION when you change files.
// Same-origin app shell only — YouTube embeds are never cached here.
const VERSION = 'rep-v2.0.0';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json',
  './src/app.js', './src/store.js', './src/logic.js', './src/program.js', './src/exercises.js', './src/body.js', './src/charts.js', './src/progression.js', './src/renpho.js', './src/plates.js', './src/fatloss.js', './src/checkin.js', './src/backup.js', './src/swap.js', './src/foods.js', './src/food-api.js', './src/expenditure.js', './src/volume.js', './src/summary.js', './src/deload.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // stale-while-revalidate
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit || c.match('./index.html'));
    return hit || net;
  }));
});
// Tap the rest-over notification → back to the open workout.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
