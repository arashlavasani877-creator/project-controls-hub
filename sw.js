/* PCH v22 — update-safe app shell. Data live in Firestore, never in service-worker caches. */
const CACHE='pch-shell-v23-8-manager-directory';
const SHELL=['./','./index.html','./app.js','./manifest.webmanifest','./pch-logo.png','./pch-icon-192.png','./pch-icon-180.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pch-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==='navigate'||new URL(req.url).pathname.endsWith('/app.js')||new URL(req.url).pathname.endsWith('/index.html')){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const clone=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,clone)))}return res}).catch(()=>caches.match(req).then(v=>v||caches.match('./index.html'))));
  return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)))}return res})));
});
