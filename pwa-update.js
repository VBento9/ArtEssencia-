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

 function showVersionInHeader(){
  const heading=document.querySelector('.page-heading');
  if(!heading||document.getElementById('ae-visible-app-version'))return;
  const info=document.createElement('small');
  info.id='ae-visible-app-version';
  info.setAttribute('aria-label','Versão atual do Backoffice');
  info.textContent='Versão instalada: '+(running||'por identificar');
  Object.assign(info.style,{display:'block',fontSize:'11px',lineHeight:'1.3',marginTop:'4px',letterSpacing:'normal',color:'#796656'});
  heading.append(info);
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
   if(typeof productSyncBusyV19104==='boolean'&&productSyncBusyV19104)return true;
   if(typeof hasPendingProductEditsV19102==='function'&&hasPendingProductEditsV19102())return true;
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

 // Uma cópia guardada na Cloud não prova que esta sessão tenha persistido a memória.
 // A confirmação é local: sem comparação exata, nunca navegar automaticamente.
 function pwaDurableSnapshotV19187(){
  try{return typeof KEY==='string'&&typeof db!=='undefined'&&localStorage.getItem(KEY)===JSON.stringify(db)}
  catch(_){return false}
 }
 let backupRequestedV19187=false,backupSnapshotV19187='';
 function pwaExportBeforeUpdateV19187(){
  try{
   if(typeof backupBlob!=='function'||typeof backupFileName!=='function'||typeof downloadBlob!=='function')throw new Error('Backup indisponível');
   const blob=backupBlob();
   if(!blob||!blob.size)throw new Error('Backup vazio');
   downloadBlob(blob,backupFileName('ArtEssencia_ANTES_ATUALIZAR'));
   backupRequestedV19187=true;
   try{backupSnapshotV19187=JSON.stringify(db)}catch(_){backupSnapshotV19187=''}
   bannerMessage('Cópia dos dados em memória preparada. Confirma que o ficheiro JSON ficou guardado antes de continuar.');
   return true;
  }catch(error){backupRequestedV19187=false;backupSnapshotV19187='';bannerMessage('Não foi possível criar o backup: '+String(error?.message||error));return false}
 }
 function pwaPersistBeforeUpdateV19187(){
  if(!backupRequestedV19187){bannerMessage('Primeiro descarrega uma cópia dos dados em memória.');return false}
  try{if(!backupSnapshotV19187||backupSnapshotV19187!==JSON.stringify(db)){backupRequestedV19187=false;bannerMessage('Os dados mudaram depois do backup. Descarrega uma cópia atualizada antes de guardar.');return false}}catch(_){backupRequestedV19187=false;bannerMessage('Não foi possível verificar o backup. Não atualizar.');return false}
  if((typeof cloudBusy==='boolean'&&cloudBusy)||
     (typeof cloudPushRunning==='boolean'&&cloudPushRunning)||
     (typeof productSyncBusyV19104==='boolean'&&productSyncBusyV19104)||
     (typeof cloudHydrating==='boolean'&&cloudHydrating)||
     (typeof hasRestorePendingV12645==='function'&&hasRestorePendingV12645())){
   bannerMessage('Existe uma operação Cloud ou restauro em curso. Não guardar nem atualizar ainda.');return false
  }
  if(!confirm('Confirma que guardaste o ficheiro JSON de recuperação fora da aplicação? Apenas depois vamos guardar o estado local e tentar atualizar.'))return false;
  try{
   if(typeof save!=='function'||!save('none')||!pwaDurableSnapshotV19187()){
    bannerMessage('A gravação local não foi confirmada. Não atualizar. Preserva o ficheiro JSON.');
    return false;
   }
  }catch(error){bannerMessage('Falha de gravação local: '+String(error?.message||error)+'. Não atualizar.');return false}
  backupRequestedV19187=false;backupSnapshotV19187='';
  reloadFresh();
  return true;
 }

 function reloadFresh(){
  const pending=syncPending(),durable=pwaDurableSnapshotV19187();
  if(pending||!durable){
   // A atualização do código não exige que o conflito remoto seja resolvido.
   // A cópia local permanece no armazenamento do dispositivo após a navegação.
   if((typeof cloudBusy==='boolean'&&cloudBusy)||
      (typeof cloudPushRunning==='boolean'&&cloudPushRunning)||
      (typeof productSyncBusyV19104==='boolean'&&productSyncBusyV19104)||
      (typeof cloudHydrating==='boolean'&&cloudHydrating)||
      (typeof hasRestorePendingV12645==='function'&&hasRestorePendingV12645())){
     bannerMessage('Operação Cloud ou restauro em curso. Não atualizar ainda.');return;
   }
   if(!durable){bannerMessage('A memória diverge do armazenamento local. Descarrega uma cópia de recuperação e guarda localmente antes de atualizar.');return}
   if(pending&&!confirm('Existem dados locais ainda não confirmados na Cloud. A atualização mantém o armazenamento deste dispositivo, mas não resolve os conflitos. Guarda os campos que estás a editar. Atualizar agora?'))return;
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
  // O ecrã de recuperação é opcional: nunca guarda, substitui ou envia dados
  // sem a ação explícita da pessoa. Mantém-se disponível enquanto a memória diverge.
  if(!pwaDurableSnapshotV19187()){
   const recovery=document.createElement('div');
   recovery.setAttribute('data-ae-update-recovery','1');
   recovery.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:12px';
   const backup=document.createElement('button');
   backup.type='button';backup.className='btn';backup.textContent='Guardar backup de recuperação';
   backup.onclick=pwaExportBeforeUpdateV19187;
   const persist=document.createElement('button');
   persist.type='button';persist.className='btn';
   persist.textContent='Guardar localmente e atualizar';
   persist.onclick=pwaPersistBeforeUpdateV19187;
   recovery.append(backup,persist);box.append(recovery);
  }
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
    try{if(sessionStorage.getItem(EXPECTED_KEY)===running)sessionStorage.removeItem(EXPECTED_KEY)}catch(_){}
    closeOffer();
    return;
   }
   // Não anunciar retrocessos da Vercel como uma nova atualização.
   if(!isNewer(version.app,running)){closeOffer();return}
   // Nunca esconder silenciosamente uma atualização que não ficou instalada.
   let attempted='';
   try{attempted=sessionStorage.getItem(EXPECTED_KEY)||''}catch(_){}
   offerUpdate(version.app);
   if(attempted===version.app){
    bannerMessage('A atualização anterior não foi concluída. Continua na versão '+running+'; tenta atualizar novamente após confirmar a sincronização Cloud.');
    const retry=updateBanner?.querySelector('button');
    if(retry)retry.textContent='Tentar novamente';
   }
  }catch(error){console.warn('Verificação de atualização adiada:',error)}
  finally{checking=false}
 }

 showInstalledNotice();
 showVersionInHeader();
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
