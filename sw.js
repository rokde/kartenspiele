const VERSION = "dev";
const PRECACHE = [];
// scripts/cache-bust.js fills in the two lines above for a deploy. "dev" caches nothing.
const CACHE = `karten-${VERSION}`;
const DEV = VERSION === "dev";

self.addEventListener("install", (event) => {
  // "reload" skips the HTTP cache, so the new cache never gets an old index.html.
  const fill = DEV ? Promise.resolve() : caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))));
  event.waitUntil(fill.then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("index.html"))));
  } else {
    event.respondWith(caches.match(request).then((r) => r || fetch(request)));
  }
});
