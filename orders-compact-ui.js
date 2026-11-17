/* ArtEssencia — Encomendas: apresentação e salvaguarda da identidade dos clientes. */
(function(){
 'use strict';
 function init(){
  const root=document.getElementById('orders');
  if(!root||document.getElementById('aeOrdersCompact'))return;
  const toolbar=root.querySelector('.orders-toolbar-controls-v1728');
  if(!toolbar)return;
  const dateFields=[...toolbar.querySelectorAll('.orders-period-v1882')];
  if(dateFields.length!==2)return;
  const advanced=document.createElement('div');
  advanced.id='aeOrdersAdvanced';advanced.className='ae-orders-advanced';
  const button=document.createElement('button');
  button.id='aeOrdersCompact';button.type='button';button.className='btn ghost';
  button.textContent='Filtrar por datas';button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls','aeOrdersAdvanced');
  const anchor=toolbar.querySelector('.orders-filter-utility-v1915')||dateFields[1].nextElementSibling;
  if(anchor)toolbar.insertBefore(button,anchor);else toolbar.append(button);
  toolbar.insertBefore(advanced,button);
  dateFields.forEach(field=>advanced.append(field));
  function dateCount(){
   return dateFields.reduce((total,field)=>total+[...field.querySelectorAll('input')].filter(x=>!!String(x.value||'').trim()).length,0);
  }
  function apply(open){
   advanced.hidden=!open;
   button.setAttribute('aria-expanded',String(open));
   const count=dateCount();
   button.dataset.hasDates=count?'true':'false';
   button.textContent=open?'Recolher datas':count?'Datas ativas · Alterar':'Filtrar por datas';
   button.setAttribute('aria-label',count
    ?(open?'Recolher filtros por datas; '+count+' datas definidas':'Alterar filtros por datas; '+count+' datas definidas')
    :(open?'Recolher filtros por datas':'Filtrar por datas'));
  }
  const hasDates=dateFields.some(field=>[...field.querySelectorAll('input')].some(input=>!!input.value));
  button.addEventListener('click',()=>apply(advanced.hidden));
  dateFields.forEach(field=>field.querySelectorAll('input').forEach(input=>{
   input.addEventListener('change',()=>apply(!advanced.hidden));
   input.addEventListener('input',()=>apply(!advanced.hidden));
  }));
  apply(hasDates);
  const header=document.querySelector('.topbar');
  if(header){const measure=()=>root.style.setProperty('--ae-orders-top-offset',(header.getBoundingClientRect().height+8)+'px');measure();if(typeof ResizeObserver!=='undefined')new ResizeObserver(measure).observe(header)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


/* V1.9.157 — identidade do cliente nas encomendas; sem atualização automática de históricos. */
(function(){
 'use strict';
 function install(){
  if(window.__aeOrderClientIdentity19157)return;
  if(typeof upsertClientFromOrder!=='function'||typeof ensureClientsFromOrders!=='function'||typeof chooseSaleClientV1756!=='function')return;
  const nameInput=document.getElementById('saleClient');
  const matchBox=document.getElementById('saleClientMatchesV1756');
  if(!nameInput||!matchBox)return;
  window.__aeOrderClientIdentity19157=true;
  const normal=v=>String(v||'').trim().toLocaleLowerCase('pt-PT').replace(/\s+/g,' ');
  const safe=c=>c&&!isQuarantinedProductClient(c);
  const exact=name=>{
   const matches=(db.clients||[]).filter(c=>safe(c)&&normal(c.name)===normal(name));
   return matches.length===1?matches[0]:null;
  };
  const label=document.createElement('label');
  label.className='sale-client-new-v19157';
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.id='saleNewClientV19157';
  label.append(checkbox,document.createTextNode(' Criar ficha independente, mesmo com nome ou contacto repetido'));
  matchBox.after(label);
  let selectedId='';
  nameInput.addEventListener('input',()=>{selectedId=''},true);
  checkbox.addEventListener('change',()=>{if(checkbox.checked)selectedId=''});
  const originalChoose=chooseSaleClientV1756,originalClear=clearSale;
  window.chooseSaleClientV1756=function(id){
   originalChoose(id);
   const c=(db.clients||[]).find(c=>safe(c)&&String(c.id)===String(id));
   selectedId=c?String(c.id):'';
   if(c)checkbox.checked=false;
  };
  window.clearSale=function(){
   selectedId='';checkbox.checked=false;
   return originalClear.apply(this,arguments);
  };
  window.ensureClientsFromOrders=function(){
   db.clients=db.clients||[];
   (db.orders||[]).forEach(order=>{
    if(!order.client||order.clientDeleted)return;
    if(order.clientId&&db.clients.some(c=>safe(c)&&String(c.id)===String(order.clientId)))return;
    const name=String(order.client).trim();
    let c=exact(name);
    if(!c){
     c={id:uid('CLI'),name,phone:order.contact||'',email:order.email||'',notes:'',created:order.created||todayISO(),source:order.source==='online_store'?'online_store':'order'};
     db.clients.push(c);
    }
    order.clientId=c.id;
   });
  };
  window.upsertClientFromOrder=function(name,contact,email=''){
   name=String(name||'').trim();if(!name)return null;
   db.clients=db.clients||[];
   let c=null;
   if(!checkbox.checked){
    c=(db.clients||[]).find(c=>safe(c)&&String(c.id)===selectedId&&normal(c.name)===normal(name))||exact(name);
   }
   selectedId='';
   const mail=String(email||'').trim().toLowerCase();
   if(c){
    if(!c.name)c.name=name;
    if(!c.phone&&contact)c.phone=contact;
    if(!c.email&&mail)c.email=mail;
    return c.id;
   }
   c={id:uid('CLI'),name,phone:contact||'',email:mail,notes:'',created:todayISO(),source:'order'};
   db.clients.push(c);
   return c.id;
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
