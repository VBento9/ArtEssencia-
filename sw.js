const CACHE='artessencia-atelier-1.0.0';
const SHELL=['./','index.html','app.css','app.js','db.js','domain.js','views.js','ui.js','audit.js','version.json','manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/version.json')) { e.respondWith(fetch(e.request,{cache:'no-store'})); return; }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;}).catch(()=>cached)));
});
