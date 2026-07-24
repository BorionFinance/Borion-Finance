// Borion Finance 6.46.20 — modo Google Drive estrito, sem cache offline.
const VERSION='6.46.20';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
// Nenhuma estratégia de cache: todas as requisições seguem diretamente para a rede.
