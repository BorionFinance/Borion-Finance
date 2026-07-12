// Service worker do Borion Finance.
// Versão modular: cacheia o HTML, CSS e os arquivos JS separados.
// Estratégia: stale-while-revalidate.
//
// Ao editar o app e quiser forçar atualização do cache, aumente o número abaixo.
const CACHE_NAME = 'borion-finance-v6-23-1-account-id-integrity';

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/00-utils.js",
  "./js/01-storage-data-state.js",
  "./js/01b-storage-provider.js",
  "./js/01c-google-drive-provider.js",
  "./js/02-backup-local.js",
  "./js/03-modals-shared.js",
  "./js/04-gate-shell.js",
  "./js/05-calculations-charts.js",
  "./js/06-overview.js",
  "./js/07-budget.js",
  "./js/08-investments.js",
  "./js/09-patrimony-goals.js",
  "./js/10-cards-accounts.js",
  "./js/11-agenda-notifications.js",
  "./js/12-bank-filter-search.js",
  "./js/13-settings.js",
  "./js/14-events-boot-pwa.js",
  "./js/15-cheques.js",
  "./js/16-import-statement.js",
  "./js/17-borion-cloud.js",
  "./js/18-order-preferences.js",
  "./js/19-subscriptions.js",
  "./FUNDO.png",
  "./borion-emblem.png",
  "./borion-full.png",
  "./icon-192.png",
    "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./borion.ico"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        ASSETS.map((asset) =>
          cache.add(asset).catch((err) => console.warn('Não foi possível cachear:', asset, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const freshFirst = request.destination === 'document' || request.destination === 'script' || request.destination === 'style';

  if (freshFirst) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
