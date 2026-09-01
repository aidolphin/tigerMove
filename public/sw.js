const CACHE_VERSION = "tigermove-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.error("SW install failed:", error);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  if (isApiRequest(url) || isWebSocketRequest(url)) {
    return;
  }

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(() => {
          return caches.match("/").then((cached) => {
            return cached || new Response("<html><body><h1>TigerMove is offline</h1><p>Please check your connection.</p></body></html>", {
              status: 503,
              headers: { "Content-Type": "text/html" },
            });
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(() => {
        return new Response("Offline", { status: 503 });
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "TigerMove", body: "You have a new update", tag: "tigermove" };
  if (event.data) {
    try {
      data = { ...data, ...(event.data.json() as Record<string, unknown>) };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const title = String(data.title || "TigerMove");
  const body = String(data.body || "");
  const tag = String(data.tag || "tigermove-default");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: false,
      requireInteraction: false,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: (event.data && event.data.json()) || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith("/api/") || 
         url.pathname.startsWith("/ws/") ||
         url.hostname !== self.location.hostname;
}

function isWebSocketRequest(url: URL): boolean {
  return url.pathname.startsWith("/ws/");
}

function isNavigationRequest(request: Request): boolean {
  return request.mode === "navigate";
}
