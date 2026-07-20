// Service worker do Borion Finance.
// Versão modular: cacheia o HTML, CSS e os arquivos JS separados.
// Estratégia: stale-while-revalidate.
//
// Ao editar o app e quiser forçar atualização do cache, aumente o número abaixo.
const CACHE_NAME = 'borion-finance-v6-38-2-menu-e-importacao';

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css?v=6.38.2",
  "./css/borion-hub.css?v=6.38.2",
  "./js/00-utils.js?v=6.38.2",
  "./js/borion-hub.js?v=6.38.2",
  "./js/01-storage-data-state.js?v=6.38.2",
  "./js/01b-storage-provider.js?v=6.38.2",
  "./js/01c-google-drive-provider.js?v=6.38.2",
  "./js/01d-data-guard.js?v=6.38.2",
  "./js/02-backup-local.js?v=6.38.2",
  "./js/03-modals-shared.js?v=6.38.2",
  "./js/04-gate-shell.js?v=6.38.2",
  "./js/05-calculations-charts.js?v=6.38.2",
  "./js/06-overview.js?v=6.38.2",
  "./js/07-budget.js?v=6.38.2",
  "./js/08-investments.js?v=6.38.2",
  "./js/09-patrimony-goals.js?v=6.38.2",
  "./js/10-cards-accounts.js?v=6.38.2",
  "./js/11-agenda-notifications.js?v=6.38.2",
  "./js/12-bank-filter-search.js?v=6.38.2",
  "./js/13-settings.js?v=6.38.2",
  "./js/14-events-boot-pwa.js?v=6.38.2",
  "./js/15-cheques.js?v=6.38.2",
  "./js/16-import-statement.js?v=6.38.2",
  "./js/17-borion-cloud.js?v=6.38.2",
  "./js/18-order-preferences.js?v=6.38.2",
  "./js/19-subscriptions.js?v=6.38.2",
  "./js/20-smartphone-mode.js?v=6.38.2",
  "./js/21-smartphone-history.js?v=6.38.2",
  "./js/22-mobile-experience.js?v=6.38.2",
  "./js/23-profile-import-review.js?v=6.38.2",
  "./js/24-interconnections.js?v=6.38.2",
  "./js/25-module-layout.js?v=6.38.2",
  "./css/help-center.css?v=6.38.2",
  "./js/26-help-center.js?v=6.38.2",
  "./borion-emblem.png",
  "./borion-full.png",
  "./icon-192.png",
    "./icon-512-maskable.png",
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
  const url = new URL(request.url);

  // V6.37.0 — CORREÇÃO CRÍTICA: antes, este service worker interceptava e
  // cacheava QUALQUER requisição GET, inclusive as chamadas à API do Google
  // Drive (mesmo arquivo, mesma URL a cada leitura de current.json — ex.:
  // .../files/{id}?alt=media). Isso podia servir uma versão ANTIGA da conta
  // (ou de metadados usados para detectar conflito) direto do cache do
  // navegador, em vez de buscar a de verdade no Drive — exatamente o tipo de
  // problema que motivou tirar qualquer cache local do caminho de decisão.
  // Chamadas de outra origem (googleapis.com, accounts.google.com etc.) agora
  // nunca são interceptadas nem cacheadas por este service worker; o
  // navegador as trata normalmente, sempre indo à rede.
  if (url.origin !== self.location.origin) return;

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
