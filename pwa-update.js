/* Backoffice updates never clear data or reload an editor without consent. */
(()=>{
 let running=document.querySelector('meta[name="artessencia-version"]')?.content||'';
 try{if(typeof APP_VERSION==='string')running=APP_VERSION}catch(_){}
 let registration,checking=false;
 function reloadFresh(){
  const url=new URL(location.href);url.searchParams.set('ae_update',Date.now().toString());
  // Navigation is network-first in sw.js. No unregister, storage reset or session loss.
  location.replace(url.href);
 }
 function offerUpdate(version){
  if(document.getElementById('ae-update-available'))return;
  const box=document.createElement('div');box.id='ae-update-available';box.setAttribute('role','status');
  Object.assign(box.style,{position:'fixed',bottom:'20px',left:'16px',right:'16px',zIndex:'2147483647',padding:'16px',background:'#fff',color:'#5a240b',border:'2px solid #5a240b',borderRadius:'12px'});
  const message=document.createElement('span');message.textContent='Versão '+version+' disponível. Guarda o que estás a editar antes de atualizar. ';
  const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='Carregar atualização';
  button.onclick=reloadFresh;box.append(message,button);document.body.append(box);
 }
 async function check(){
  if(checking||!navigator.onLine)return;checking=true;
  try{
   // Failure to update the worker must not prevent checking the deployed version.
   try{await registration?.update()}catch(error){console.warn('Service Worker: atualização adiada',error)}
   const response=await fetch('/version.json?t='+Date.now(),{cache:'no-store'});
   if(!response.ok)return;const version=await response.json();
   if(version.channel==='artessencia-backoffice-stable'&&typeof version.app==='string'&&version.app!==running)offerUpdate(version.app);
  }catch(error){console.warn('Verificação de atualização adiada:',error)}finally{checking=false}
 }
 if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
  navigator.serviceWorker.addEventListener('controllerchange',check);
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;check()}).catch(error=>{console.warn(error);check()});
 }else check();
 window.addEventListener('online',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 setInterval(check,5*60*1000);
})();
