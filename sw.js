self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch{data={body:event.data?event.data.text():'Nova notificação DONART'};}
  event.waitUntil((async()=>{
    const notificationData=data?.data||{};
    const eventRequestId=String(notificationData.eventRequestId||data?.eventRequestId||'').trim();
    const orderId=String(notificationData.orderId||notificationData.publicId||data?.orderId||'').trim();
    const isEventRequest=notificationData.type==='event_request'||!!eventRequestId;
    const messageType=isEventRequest?'DONART_PUSH_EVENT_REQUEST':'DONART_PUSH_ORDER';
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const visible=windows.find(c=>c.visibilityState==='visible');
    if(visible){
      try{visible.postMessage({type:messageType,payload:data});}catch{}
      return;
    }
    const sourceId=isEventRequest?eventRequestId:orderId;
    const title=data.title||(isEventRequest?'DONART · Novo pedido de orçamento':'DONART · Nova encomenda');
    const fallbackUrl=isEventRequest
      ?(eventRequestId?'./?pushEventRequest='+encodeURIComponent(eventRequestId):'./')
      :(orderId?'./?pushOrder='+encodeURIComponent(orderId):'./');
    const options={
      body:data.body||(isEventRequest?'Recebeste um novo pedido de orçamento para evento.':'Recebeste uma nova encomenda.'),
      icon:data.icon||'./icon-192.png',
      badge:data.badge||'./icon-192.png',
      tag:data.tag||(isEventRequest?'donart-event-request-':'donart-order-')+(sourceId||Date.now()),
      renotify:data.renotify!==false,
      data:{...notificationData,url:notificationData.url||fallbackUrl}
    };
    await self.registration.showNotification(title,options);
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification?.data?.url||'./';
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      try{
        if('focus' in client){
          if('navigate' in client)await client.navigate(target);
          await client.focus();
          return;
        }
      }catch{}
    }
    if(clients.openWindow)return clients.openWindow(target);
  })());
});
