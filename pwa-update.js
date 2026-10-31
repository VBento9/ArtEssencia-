/* Backoffice PWA updates stay in-place: never clear caches, Cloud data or installed app storage. */
(()=>{
 let running=document.querySelector('meta[name="artessencia-version"]')?.content||'';
 try{if(typeof APP_VERSION==='string')running=APP_VERSION}catch(_){}
 let registration=null,checking=false,latestVersion='',updateBanner=null;
 const EXPECTED_KEY='artessencia_pwa_expected_version_v1948';
 function isNewer(next,installed){
  const a=String(next||'').split('.').map(Number),b=String(installed||'').split('.').map(Number);
  if(a.length===3&&b.length===3&&a.every(Number.isInteger)&&b.every(Number.isInteger)){
   for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i]}
   return false;
  }
  return !!next&&next!==installed;
 }
 function closeOffer(){
  document.getElementById('ae-update-available')?.remove();
  updateBanner=null;latestVersion='';
 }

 function syncPending(){
  try{
   if(typeof cloudMeta==='function'){
    const meta=cloudMeta()||{};
    if(meta.dirty||meta.conflict)return true;
   }
   if(typeof REL_DIRTY==='string'&&localStorage.getItem(REL_DIRTY)==='1')return true;
   if(typeof cloudPushPending==='boolean'&&cloudPushPending)return true;
   if(typeof cloudPushRunning==='boolean'&&cloudPushRunning)return true;
   if(typeof cloudHydrating==='boolean'&&cloudHydrating)return true;
   if(typeof relOrderPendingSet==='function'&&relOrderPendingSet().size>0)return true;
   if(typeof hasRestorePendingV12645==='function'&&hasRestorePendingV12645())return true;
   return false;
  }catch(_){
   // When local state cannot be verified, do not force navigation away from it.
   return true;
  }
 }

 function bannerMessage(message){
  const status=updateBanner?.querySelector('[data-ae-update-status]');
  if(status)status.textContent=message;
 }

 function reloadFresh(){
  if(syncPending()){
   bannerMessage('Há alterações por sincronizar. Confirma o estado em Cloud Sync e volta a selecionar Atualizar agora.');
   return;
  }
  const button=updateBanner?.querySelector('button');
  if(button){button.disabled=true;button.textContent='A atualizar…'}
  try{sessionStorage.setItem(EXPECTED_KEY,latestVersion)}catch(_){}
  const url=new URL(location.href);
  url.searchParams.set('ae_update',Date.now().toString());
  // sw.js fetches navigation network-first, including inside the installed PWA.
  location.replace(url.href);
 }

 function offerUpdate(version){
  latestVersion=version;
  if(document.getElementById('ae-update-available')){
   bannerMessage('Versão '+running+' instalada · versão '+version+' disponível.');
   return;
  }
  const box=document.createElement('div');
  box.id='ae-update-available';
  box.setAttribute('role','status');
  box.setAttribute('aria-live','polite');
  Object.assign(box.style,{position:'fixed',bottom:'20px',left:'16px',right:'16px',zIndex:'2147483647',padding:'16px',background:'#fff',color:'#5a240b',border:'2px solid #5a240b',borderRadius:'12px',boxShadow:'0 6px 20px rgba(0,0,0,.12)'});
  const message=document.createElement('span');
  message.textContent='Nova versão ArtEssencia disponível. Guarda o que estás a editar antes de atualizar. ';
  const status=document.createElement('div');
  status.dataset.aeUpdateStatus='1';
  status.style.cssText='font-size:13px;margin:7px 0';
  status.textContent='Versão '+running+' instalada · versão '+version+' disponível.';
  const button=document.createElement('button');
  button.type='button';button.className='btn primary';button.textContent='Atualizar agora';
  button.onclick=reloadFresh;
  box.append(message,status,button);
  document.body.append(box);
  updateBanner=box;
 }

 function showInstalledNotice(){
  let expected='';
  try{expected=sessionStorage.getItem(EXPECTED_KEY)||'';if(expected===running)sessionStorage.removeItem(EXPECTED_KEY)}catch(_){}
  if(!expected||expected!==running)return;
  const box=document.createElement('div');
  box.setAttribute('role','status');
  box.textContent='ArtEssencia atualizada para a versão '+running+'.';
  Object.assign(box.style,{position:'fixed',bottom:'16px',left:'16px',right:'16px',zIndex:'2147483646',padding:'11px 14px',borderRadius:'10px',background:'#fff',border:'1px solid #5a240b',color:'#5a240b',boxShadow:'0 4px 16px rgba(0,0,0,.1)'});
  document.body.append(box);
  setTimeout(()=>box.remove(),5000);
 }

 async function check(){
  if(checking||navigator.onLine===false)return;
  checking=true;
  try{
   // Also check version.json when a Service Worker update is postponed or fails.
   try{await registration?.update()}catch(error){console.warn('Atualização do Service Worker adiada',error)}
   const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});
   if(!response.ok)return;
   const version=await response.json();
   if(version?.channel!=='artessencia-backoffice-stable'||typeof version.app!=='string')return;
   if(version.app===running){
    closeOffer();
    return;
   }
   // Não anunciar retrocessos da Vercel como uma nova atualização.
   if(!isNewer(version.app,running)){closeOffer();return}
   // Depois de tentar atualizar esta versão, não repetir o mesmo aviso
   // indefinidamente caso um navegador continue a servir o HTML antigo.
   let attempted='';
   try{attempted=sessionStorage.getItem(EXPECTED_KEY)||''}catch(_){}
   if(attempted===version.app){closeOffer();return}
   offerUpdate(version.app);
  }catch(error){console.warn('Verificação de atualização adiada:',error)}
  finally{checking=false}
 }

 showInstalledNotice();
 if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
  navigator.serviceWorker.addEventListener('controllerchange',check);
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;check()}).catch(error=>{console.warn(error);check()});
 }else check();
 window.addEventListener('online',check);
 window.addEventListener('pageshow',check);
 window.addEventListener('focus',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 setInterval(check,5*60*1000);
})();
