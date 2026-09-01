// The production build replaces this expression with a content fingerprint.
const CACHE_NAME = self.__RT_SITRAM_CACHE_NAME__ ?? "rt-sitram-pwa-shell-development";
const CACHE_PREFIX = "rt-sitram-pwa-shell-";
// The production build replaces this expression with every emitted JS worker,
// chunk and WASM dependency needed to reopen SQLite without a network.
const APP_SHELL_PATHS = self.__RT_SITRAM_PRECACHE__ ?? [];

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

  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstAppShell(event.request));
    return;
  }

  if (isStaticAssetRequest(event.request, requestUrl)) {
    event.respondWith(cacheFirstStaticAsset(event.request));
  }
});

function isStaticAssetRequest(request, requestUrl) {
  return (
    APP_SHELL_PATHS.includes(requestUrl.pathname) ||
    requestUrl.pathname.startsWith("/assets/") ||
    requestUrl.pathname.startsWith("/icons/") ||
    ["script", "style", "worker", "font", "image"].includes(request.destination)
  );
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

async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}
