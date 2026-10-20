/* Backoffice PWA updater: reload only after the current worker has been checked. No user storage is cleared. */
(()=>{
 const running=typeof APP_VERSION==='string'?APP_VERSION:'';
 let registration,checking=false,applying=false;
 async function fetchCurrentVersion(){
  const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('Não foi possível consultar a versão');
  return response.json();
 }
 function offerUpdate(){
  if(document.getElementById('ae-update-available'))return;
  const box=document.createElement('div');box.id='ae-update-available';box.setAttribute('role','status');
  Object.assign(box.style,{position:'fixed',bottom:'20px',left:'16px',right:'16px',zIndex:'99999',padding:'16px',background:'#fff',color:'#5a240b',border:'2px solid #5a240b',borderRadius:'12px'});
  const message=document.createElement('span');message.textContent='Atualização disponível. Guarda o trabalho antes de atualizar. ';
  const button=document.createElement('button');button.className='btn primary';button.textContent='Carregar atualização';
  button.onclick=async()=>{
   if(applying)return;applying=true;button.disabled=true;button.textContent='A atualizar…';
   try{
    if(!navigator.onLine)throw Error('Sem ligação à internet');
    const reg=registration||await navigator.serviceWorker?.getRegistration();
    if(reg){
     await reg.update();
     if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
    }
    const latest=await fetchCurrentVersion();
    if(latest.app===running){box.remove();return}
    // A navigation request must bypass HTTP cache; the existing service worker
    // already implements network-first navigation and no-store for JS/JSON.
    const target=new URL(location.href);
    target.searchParams.set('ae_pwa_refresh',Date.now().toString());
    location.replace(target.href);
   }catch(error){
    message.textContent='Não foi possível atualizar. Confirma a ligação e tenta novamente. ';
    console.warn('Atualização manual falhou:',error);
    button.disabled=false;button.textContent='Tentar novamente';applying=false;
   }
  };
  box.append(message,button);document.body.append(box);
 }
 async function check(){
  if(checking||!navigator.onLine)return;checking=true;
  try{
   await registration?.update();
   const version=await fetchCurrentVersion();
   if(version.channel==='artessencia-backoffice-stable'&&typeof version.app==='string'&&version.app!==running)offerUpdate();
  }catch(error){console.warn('Verificação de atualização adiada:',error)}finally{checking=false}
 }
 if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;check()}).catch(console.warn);
 }
 window.addEventListener('online',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 setInterval(check,5*60*1000);
})();
