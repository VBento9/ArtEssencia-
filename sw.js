const CACHE='artessencia-backoffice-1.9.57';
const SUPABASE_SDK="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.0";
const CORE=["/quantity-pricing-v2.js","/quantity-pricing-v2.css","/boxes-atelier-ui-v1.js","/catalog-pdf-manager-v2.js","/catalog-background-presets.js","/module-search-shortcut.js", "/module-search-shortcut.css", "/tablet-navigation.js", "/tablet-navigation.css", "/layout-refinement.css?v=20261026", "/cash-compact-ui.js", "/cash-compact-ui.css", "/purchases-compact-ui.js", "/purchases-compact-ui.css", "/clients-compact-ui.js", "/clients-compact-ui.css", "/", "/index.html", "/pwa-update.js", "/manifest.webmanifest", "/brand-artessencia.png", "/icon-192.png", "/icon-512.png", "/order-detail-compact-ui.js", "/order-detail-compact-ui.css", "/production-compact-ui.js", "/production-compact-ui.css", "/product-editor-guide.js", "/product-editor-guide.css", "/stock-compact-ui.js", "/stock-compact-ui.css", "/dashboard-compact-ui.js", "/dashboard-compact-ui.css", "/product-technical-sheet.js", "/products-compact-ui.js", "/products-compact-ui.css", "/orders-compact-ui.js", "/orders-compact-ui.css"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).then(()=>c.addAll([SUPABASE_SDK]).catch(()=>{}))));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('artessencia-backoffice-')||k.startsWith('artessencia-v12-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),sdk=url.href===SUPABASE_SDK;
 if(url.origin!==self.location.origin&&!sdk)return;
 // API responses and version discovery remain network-only.
 if(!sdk&&(/\.(?:json|webmanifest)$/i.test(url.pathname)||url.pathname==='/sw.js'||url.pathname.startsWith('/api/'))){event.respondWith(fetch(event.request,{cache:'no-store'}));return}
 const code=sdk||/\.(?:js|css)$/i.test(url.pathname);
 const task=(async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(event.request,{cache:code||event.request.mode==='navigate'?'no-store':'default'});
   if(!response.ok)throw new Error('Resource unavailable');
   try{await cache.put(event.request,response.clone())}catch(e){}
   return response;
  }catch(e){
   return await cache.match(event.request)||(event.request.mode==='navigate'?await cache.match('/index.html'):null)||Response.error();
  }
 })();
 event.respondWith(task);
});
function pushPayload(event){try{return event.data?.json?.()||{}}catch(e){return {body:event.data?.text?.()||''}}}
self.addEventListener('push',event=>{
 const data=pushPayload(event),kind=String(data.type||data.kind||data.event||'').toLowerCase();
 const isEvent=kind.includes('event')||kind.includes('quote')||kind.includes('orcamento')||kind.includes('orçamento');
 const id=data.order_id||data.orderId||data.request_id||data.requestId||data.id||'';
 const title=data.title||(isEvent?'Novo pedido de orçamento ArtEssencia':'Nova encomenda ArtEssencia');
 const body=data.body||data.message||(isEvent?'Recebeste um novo pedido de orçamento.':'Recebeste uma nova encomenda.');
 const url=data.url||(isEvent&&id?`./?pushEventRequest=${encodeURIComponent(id)}`:id?`./?pushOrder=${encodeURIComponent(id)}`:'./');
 const msgType=isEvent?'ArtEssencia_PUSH_EVENT_REQUEST':'ArtEssencia_PUSH_ORDER';
 event.waitUntil(Promise.all([
  self.registration.showNotification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',tag:isEvent?'artessencia-event':'artessencia-order',renotify:true,data:{url,msgType,id}}),
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:msgType,id})))
 ]));
});
function safePushUrl(value){try{const u=new URL(String(value||'/'),self.location.origin);return u.origin===self.location.origin?u.href:self.location.origin+'/'}catch{return self.location.origin+'/'}}
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=safePushUrl(event.notification?.data?.url);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async cs=>{for(const c of cs){if('focus'in c){await c.focus();if('navigate'in c)await c.navigate(url);return}}if(self.clients.openWindow)return self.clients.openWindow(url)}));
});
