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
    // Other apps on the same origin (rokde.github.io, localhost) keep their caches.
    .then((names) => Promise.all(names.filter((name) => name.startsWith("karten-") && name !== CACHE).map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("index.html"))));
  } else {
    event.respondWith(fromCache(request));
  }
});

// Safari loads media with Range requests and accepts only a 206 answer.
async function fromCache(request) {
  const cached = await caches.match(request);
  const range = request.headers.get("Range");
  if (!cached || !range) return cached || fetch(request);
  const m = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!m) return fetch(request);
  const blob = await cached.blob();
  const start = Number(m[1]);
  const end = Math.min(m[2] ? Number(m[2]) : Infinity, blob.size - 1);
  if (start > end) return fetch(request);
  const body = blob.slice(start, end + 1);
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Type": cached.headers.get("Content-Type") ?? "",
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Content-Length": String(body.size),
      "Accept-Ranges": "bytes",
    },
  });
}
