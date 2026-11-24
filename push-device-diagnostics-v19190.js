/* Local diagnostic: no writes to operational data or subscriptions. */
async function testPushDeviceV19190(){
 const note=document.getElementById('pushNoteV12625'),button=document.getElementById('pushTestBtnV19190');
 if(!note||!button)return;
 button.disabled=true;
 const results=[];
 try{
  if(!('Notification' in window)||!navigator.serviceWorker)throw Error('Notificações não suportadas');
  results.push('Permissão: '+Notification.permission);
  if(Notification.permission!=='granted')throw Error('Permite notificações primeiro');
  const reg=await navigator.serviceWorker.getRegistration();
  if(!reg?.active)throw Error('Service Worker ainda não ativo');
  const sub=await reg.pushManager.getSubscription();
  results.push('Subscrição local: '+(sub?'ativa':'ausente'));
  if(sub&&typeof cloudClient!=='undefined'&&cloudClient&&typeof cloudUser!=='undefined'&&cloudUser?.id){
   try{
    const {data,error}=await cloudClient.from('artessencia_push_subscriptions').select('active').eq('user_id',cloudUser.id).eq('endpoint',sub.endpoint).maybeSingle();
    results.push('Registo Cloud: '+(error?'não verificável':data?.active?'ativo':'ausente ou inativo'));
   }catch(_){results.push('Registo Cloud: não verificável')}
  }
  try{
   const cache=await caches.open('artessencia-push-diagnostics-v1');
   const response=await cache.match('/__ae_push_diagnostics_v1');
   const last=response?await response.json():null;
   results.push(last?'Último push remoto: '+new Date(last.at).toLocaleString('pt-PT')+' — '+(last.shown?'apresentação aceite':'apresentação falhou'):'Ainda sem registo de push remoto nesta versão');
  }catch(_){results.push('Histórico local não disponível')}
  await reg.showNotification('ArtEssencia — teste local',{body:'Se estás a ver este aviso, a apresentação de notificações funciona neste dispositivo.',icon:'/icon-192.png',tag:'artessencia-local-test-'+Date.now()});
  results.push('Teste local: apresentação solicitada. Confirma se viste o aviso.');
 }catch(e){results.push('Teste interrompido: '+String(e?.message||e))}
 finally{note.textContent=results.join(' · ');button.disabled=false}
}
