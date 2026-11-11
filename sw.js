const CACHE_NAME = "anv-school-v2";

const FILES_TO_CACHE = [
  "./",
  "./manifest.json",
  "./app-icon-192.png",
  "./app-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Important: Firebase Auth + Google login requests ko bilkul mat chhedo
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("google.com") ||
    url.hostname.includes("gstatic.com") ||
    url.pathname.includes("/__/auth") ||
    url.pathname.includes("firebase")
  ) {
    return; // browser khud handle kare
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && request.method === "GET") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match("./");
      })
  );
});
