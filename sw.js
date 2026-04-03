const CACHE='bookshelf-v33';
const CORE=['/','/index.html','/data.json','/manifest.json'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('.html')||url.pathname.endsWith('.json')||url.pathname==='/'){
    e.respondWith(fetch(e.request).then(r=>{
      const rc=r.clone();caches.open(CACHE).then(c=>c.put(e.request,rc));return r;
    }).catch(()=>caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r=>{
      if(r)return r;
      return fetch(e.request).then(nr=>{
        const rc=nr.clone();caches.open(CACHE).then(c=>c.put(e.request,rc));return nr;
      });
    }));
  }
});