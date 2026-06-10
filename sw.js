/* Service worker — Diablerie
   Stratégie :
   - HTML (navigation)  -> "network-first" : on tente le réseau, on tombe sur le cache hors-ligne.
   - autres fichiers     -> "cache-first" puis mise à jour en arrière-plan.
   IMPORTANT : à chaque déploiement, change le numéro de version ci-dessous
   (ex : diablerie-v4, v3...) pour forcer la mise à jour chez tout le monde. */
const VERSION = "diablerie-v4";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting(); // le nouveau worker prend la main sans attendre
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const isHTML = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // network-first : on récupère toujours la dernière page si possible
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // cache-first pour le reste, avec rafraîchissement en arrière-plan
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// permet à la page de demander une activation immédiate
self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});
