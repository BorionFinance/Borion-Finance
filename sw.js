// Borion Finance 7.9.7 — PWA otimizado para celular, tablet e desktop.
// Somente arquivos estáticos do aplicativo entram no cache. Dados financeiros,
// respostas do Google Drive, autenticação e operações continuam sempre na rede.
const VERSION='borion-7.9.7-salvamento-drive-resiliente';
const STATIC_CACHE=`borion-static-${VERSION}`;
const STATIC_EXT=/\.(?:js|css|png|webp|svg|ico|woff2?)$/i;

self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('borion-static-')&&key!==STATIC_CACHE).map(key=>caches.delete(key)));
    if(self.registration.navigationPreload){try{await self.registration.navigationPreload.enable();}catch(_){}}
    await self.clients.claim();
  })());
});

function cacheableStatic(request,url){
  if(request.method!=='GET'||url.origin!==self.location.origin)return false;
  if(url.pathname.includes('/current.json')||url.pathname.includes('/operations/')||url.pathname.includes('/snapshots/')||url.pathname.includes('/applied/'))return false;
  return STATIC_EXT.test(url.pathname)||url.pathname.endsWith('/manifest.json');
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);

  if(request.mode==='navigate'&&url.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const response=(await event.preloadResponse)||await fetch(request);
        if(response&&response.ok){
          const cache=await caches.open(STATIC_CACHE);
          await cache.put(request,response.clone());
        }
        return response;
      }catch(_){
        return (await caches.match(request))||(await caches.match('./index.html'))||Response.error();
      }
    })());
    return;
  }

  if(!cacheableStatic(request,url))return;
  const cachePromise=caches.open(STATIC_CACHE);
  const networkPromise=(async()=>{
    const cache=await cachePromise;
    const response=await fetch(request);
    if(response&&response.ok&&response.type==='basic')await cache.put(request,response.clone());
    return response;
  })();
  event.waitUntil(networkPromise.then(()=>undefined).catch(()=>undefined));
  event.respondWith((async()=>{
    const cache=await cachePromise;
    const cached=await cache.match(request);
    return cached||networkPromise;
  })());
});
