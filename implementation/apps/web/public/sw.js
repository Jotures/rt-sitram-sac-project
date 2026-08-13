const CACHE_NAME = "rt-sitram-pwa-shell-v1";
const CACHE_PREFIX = "rt-sitram-pwa-shell-";
const APP_SHELL_PATHS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/app-icon-192.png",
  "/icons/app-icon-512.png",
  "/assets/app.js",
  "/assets/index.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_PATHS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (
    event.request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    !isAppShellRequest(event.request, requestUrl)
  ) {
    return;
  }

  event.respondWith(networkFirstAppShell(event.request));
});

function isAppShellRequest(request, requestUrl) {
  return request.mode === "navigate" || APP_SHELL_PATHS.includes(requestUrl.pathname);
}

async function networkFirstAppShell(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === "navigate") {
      return (await cache.match("/index.html")) ?? Response.error();
    }

    return Response.error();
  }
}
