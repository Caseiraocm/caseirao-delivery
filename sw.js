const CACHE='caseirao-delivery-v40';

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.map(key=>caches.delete(key)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>
        Promise.all(
          keys.filter(key=>key!==CACHE)
              .map(key=>caches.delete(key))
        )
      )
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;

  if(
    event.request.mode==='navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html')
  ){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(()=>caches.match(event.request))
  );
});
