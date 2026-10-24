/* Loaded by the installed Backoffice entrypoint. Never clears application storage. */
(()=>{
 const running=typeof APP_VERSION==='string'?APP_VERSION:'';
 let registration,checking=false,dirty=false;
 // Atualizar automaticamente ao regressar à PWA, sem descartar formulários em edição.
 document.addEventListener('input',event=>{if(event.target?.matches?.('input,textarea,select,[contenteditable]'))dirty=true},{capture:true});
 document.addEventListener('change',event=>{if(event.target?.matches?.('input,textarea,select'))dirty=true},{capture:true});
 function reloadFresh(){const url=new URL(location.href);url.searchParams.set('ae_update',Date.now().toString());location.replace(url.href)}

 function offerUpdate(){
  if(document.getElementById('ae-update-available'))return;
  const box=document.createElement('div');box.id='ae-update-available';box.setAttribute('role','status');
  Object.assign(box.style,{position:'fixed',bottom:'20px',left:'16px',right:'16px',zIndex:'99999',padding:'16px',background:'#fff',color:'#5a240b',border:'2px solid #5a240b',borderRadius:'12px'});
  const message=document.createElement('span');message.textContent='Atualização disponível. Conclui e guarda o que estás a editar antes de atualizar. ';
  const button=document.createElement('button');button.className='btn primary';button.textContent='Carregar atualização';
  button.onclick=reloadFresh;box.append(message,button);document.body.append(box);
 }
 async function check(){
  if(checking||!navigator.onLine)return;checking=true;
  try{
   await registration?.update();
   const response=await fetch('version.json?t='+Date.now(),{cache:'no-store'});
   if(!response.ok)return;const version=await response.json();
   if(version.channel==='artessencia-backoffice-stable'&&typeof version.app==='string'&&version.app!==running){if(!dirty)reloadFresh();else offerUpdate()};
  }catch(error){console.warn('Verificação de atualização adiada:',error)}finally{checking=false}
 }
 if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
  // Listen before registration/update; never reload an in-progress form automatically.
  navigator.serviceWorker.addEventListener('controllerchange',check);
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;check()}).catch(console.warn);
 }
 window.addEventListener('online',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 setInterval(check,5*60*1000);
})();
