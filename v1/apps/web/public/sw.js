// Offline service worker (FR9 / PRD NFR: offline-first; drills render from cache).
// RE-ENABLED in v0.8 with the correct strategy (v0.5's stale-cache trap is gone):
//  - navigations / HTML  → NETWORK-FIRST (fresh deploys always picked up; cache is
//                          only an offline fallback). This is the key fix.
//  - hashed build assets (/assets/*) → CACHE-FIRST (content-addressed URLs are
//                          immutable, so caching forever is safe & fast).
//  - corpus + css + manifest → STALE-WHILE-REVALIDATE (offline-ready, self-heals).
//  - /api/*              → NEVER cached (auth/sync must hit the network).
const VERSION = "v0.8.0";
const CACHE = `iman-${VERSION}`;
const PRECACHE = ["/iman-ui.css", "/corpus.json", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// IMPORTANT: clone the response SYNCHRONOUSLY, right after fetch, and cache the
// CLONE — never clone after an await/then (the body may already be streaming to
// the page → "Response body is already used"). Cache the clone, return the original.
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const copy = res.clone();
    void caches.open(CACHE).then((c) => c.put(req, copy));
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached ?? caches.match("/");
  }
}
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  const copy = res.clone();
  void caches.open(CACHE).then((c) => c.put(req, copy));
  return res;
}
async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const network = fetch(req)
    .then((res) => {
      const copy = res.clone(); // clone BEFORE returning res
      void caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })
    .catch(() => cached);
  return cached ?? network;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return; // never cache the API

  if (req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(req)); // HTML always fresh → correct bundle
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req)); // content-hashed → safe forever
    return;
  }
  event.respondWith(staleWhileRevalidate(req));
});
