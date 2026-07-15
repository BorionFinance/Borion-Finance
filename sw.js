const CACHE='marco-iris-v1.6.6-borion-interop';
const CORE=[
  './',
  './index.html',
  './css/app.css?v=1.6.6',
  './js/data/initial-data.js?v=1.6.6',
  './js/services/storage.js?v=1.6.6',
  './js/services/google-drive.js?v=1.6.6',
  './js/services/pdf.js?v=1.6.6',
  './js/services/borion-interop-source.js?v=1.6.6',
  './js/app.js?v=1.6.6',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './assets/marco-banner.jpg',
  './assets/marco-symbol.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||!request.url.startsWith(self.location.origin))return;

  // Navegação e arquivos de código usam rede primeiro para evitar versões antigas no GitHub Pages.
  const url=new URL(request.url);
  const isCode=request.mode==='navigate'||/\.(?:html|css|js)$/.test(url.pathname);
  if(isCode){
    event.respondWith(
      fetch(request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit=>hit||fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
      return response;
    }))
  );
});
