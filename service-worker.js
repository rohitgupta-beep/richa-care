/* Richa Care — service worker (offline shell + install) */
const CACHE = "richacare-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // never cache the Apps Script backend calls
  if (req.url.includes("script.google.com") || req.url.includes("googleusercontent.com")) return;
  if (req.method !== "GET") return;

  // network-first for the HTML so updates show; cache-first for static assets
  if (req.mode === "navigate" || req.url.endsWith(".html")) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
