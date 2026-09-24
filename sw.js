const CACHE='artessencia-v1-7-84';
const CORE=['./','./index.html','./manifest.webmanifest','./brand-artessencia.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});return res}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
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
  self.registration.showNotification(title,{body,icon:'./icon-192.png',badge:'./icon-192.png',tag:isEvent?'artessencia-event':'artessencia-order',renotify:true,data:{url,msgType,id}}),
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:msgType,id})))
 ]));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=event.notification?.data?.url||'./';
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async cs=>{for(const c of cs){if('focus'in c){await c.focus();if('navigate'in c)await c.navigate(url);return}}if(self.clients.openWindow)return self.clients.openWindow(url)}));
});
